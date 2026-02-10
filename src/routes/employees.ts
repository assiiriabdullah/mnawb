import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import db, { logActivity } from '../database';
import { requireManager } from '../middleware/auth';

const router = Router();

// GET /api/employees - List all employees (manager only)
router.get('/', requireManager, (req: Request, res: Response) => {
    const employees = db.prepare(`
    SELECT id, name, username, role, shift, join_date, annual_leave_balance, created_at 
    FROM employees 
    ORDER BY 
      CASE role WHEN 'manager' THEN 0 WHEN 'supervisor' THEN 1 ELSE 2 END,
      shift, name
  `).all();
    res.json(employees);
});

// POST /api/employees - Add new employee (manager only)
router.post('/', requireManager, (req: Request, res: Response) => {
    const manager = req.session.user!;
    const { name, username, password, role, shift, join_date } = req.body;

    if (!name || !username || !password || !role || !join_date) {
        res.status(400).json({ error: 'جميع الحقول مطلوبة' });
        return;
    }

    if (role !== 'manager' && !shift) {
        res.status(400).json({ error: 'المناوبة مطلوبة للمشرفين والمنفذين' });
        return;
    }

    const existing = db.prepare('SELECT id FROM employees WHERE username = ?').get(username);
    if (existing) {
        res.status(400).json({ error: 'اسم المستخدم مستخدم بالفعل' });
        return;
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    try {
        const result = db.prepare(`
      INSERT INTO employees (name, username, password, role, shift, join_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, username, hashedPassword, role, shift || null, join_date);

        logActivity(manager.id, manager.name, 'إضافة موظف', 'موظف', name, `${role === 'supervisor' ? 'مشرف' : 'منفذ'} - مناوبة ${shift || '-'}`);

        res.status(201).json({
            message: 'تم إضافة الموظف بنجاح',
            id: result.lastInsertRowid,
        });
    } catch (err) {
        res.status(500).json({ error: 'حدث خطأ أثناء إضافة الموظف' });
    }
});

// PUT /api/employees/:id - Update employee (manager only)
router.put('/:id', requireManager, (req: Request, res: Response) => {
    const manager = req.session.user!;
    const { id } = req.params;
    const { name, username, role, shift, join_date, password } = req.body;

    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(Number(id)) as any;
    if (!employee) {
        res.status(404).json({ error: 'الموظف غير موجود' });
        return;
    }

    if (username !== employee.username) {
        const existing = db.prepare('SELECT id FROM employees WHERE username = ? AND id != ?').get(username, Number(id));
        if (existing) {
            res.status(400).json({ error: 'اسم المستخدم مستخدم بالفعل' });
            return;
        }
    }

    if (password) {
        const hashedPassword = bcrypt.hashSync(password, 10);
        db.prepare(`
      UPDATE employees SET name = ?, username = ?, password = ?, role = ?, shift = ?, join_date = ?
      WHERE id = ?
    `).run(name, username, hashedPassword, role, shift || null, join_date, Number(id));
    } else {
        db.prepare(`
      UPDATE employees SET name = ?, username = ?, role = ?, shift = ?, join_date = ?
      WHERE id = ?
    `).run(name, username, role, shift || null, join_date, Number(id));
    }

    logActivity(manager.id, manager.name, 'تعديل بيانات موظف', 'موظف', employee.name);

    res.json({ message: 'تم تعديل بيانات الموظف بنجاح' });
});

// DELETE /api/employees/:id - Delete employee (manager only)
router.delete('/:id', requireManager, (req: Request, res: Response) => {
    const manager = req.session.user!;
    const { id } = req.params;

    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(Number(id)) as any;
    if (!employee) {
        res.status(404).json({ error: 'الموظف غير موجود' });
        return;
    }

    if (employee.role === 'manager') {
        res.status(400).json({ error: 'لا يمكن حذف حساب المدير' });
        return;
    }

    db.prepare('DELETE FROM employees WHERE id = ?').run(Number(id));

    logActivity(manager.id, manager.name, 'حذف موظف', 'موظف', employee.name);

    res.json({ message: 'تم حذف الموظف بنجاح' });
});

export default router;
