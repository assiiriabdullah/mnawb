import { Router, Request, Response } from 'express';
import db, { logActivity } from '../database';
import { requireAuth, requireManager } from '../middleware/auth';

const router = Router();

// Helper: calculate number of days between two dates
function calcDays(start: string, end: string): number {
    const s = new Date(start);
    const e = new Date(end);
    const diff = e.getTime() - s.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
}

// GET /api/leaves - Get leaves based on role
router.get('/', requireAuth, (req: Request, res: Response) => {
    const user = req.session.user!;

    if (user.role === 'manager') {
        const leaves = db.prepare(`
      SELECT l.*, e.name as employee_name, e.role as employee_role, e.shift as employee_shift
      FROM leaves l
      JOIN employees e ON l.employee_id = e.id
      ORDER BY l.created_at DESC
    `).all();
        res.json(leaves);
    } else if (user.role === 'supervisor') {
        const leaves = db.prepare(`
      SELECT l.*, e.name as employee_name, e.role as employee_role, e.shift as employee_shift
      FROM leaves l
      JOIN employees e ON l.employee_id = e.id
      WHERE (e.shift = ? AND e.role = 'operator') OR l.employee_id = ?
      ORDER BY l.created_at DESC
    `).all(user.shift, user.id);
        res.json(leaves);
    } else {
        const leaves = db.prepare(`
      SELECT l.*, e.name as employee_name, e.role as employee_role, e.shift as employee_shift
      FROM leaves l
      JOIN employees e ON l.employee_id = e.id
      WHERE l.employee_id = ?
      ORDER BY l.created_at DESC
    `).all(user.id);
        res.json(leaves);
    }
});

// POST /api/leaves - Submit leave request
router.post('/', requireAuth, (req: Request, res: Response) => {
    const user = req.session.user!;

    if (user.role === 'manager') {
        res.status(403).json({ error: 'المدير لا يقدم طلبات إجازة' });
        return;
    }

    const { start_date, end_date } = req.body;

    if (!start_date || !end_date) {
        res.status(400).json({ error: 'تاريخ البداية والنهاية مطلوبان' });
        return;
    }

    if (new Date(end_date) < new Date(start_date)) {
        res.status(400).json({ error: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية' });
        return;
    }

    const days = calcDays(start_date, end_date);

    // Check remaining balance
    const emp = db.prepare('SELECT annual_leave_balance FROM employees WHERE id = ?').get(user.id) as any;
    if (emp && emp.annual_leave_balance < days) {
        res.status(400).json({ error: `رصيد الإجازات غير كافي. الرصيد المتبقي: ${emp.annual_leave_balance} يوم، المطلوب: ${days} يوم` });
        return;
    }

    try {
        const result = db.prepare(`
      INSERT INTO leaves (employee_id, start_date, end_date)
      VALUES (?, ?, ?)
    `).run(user.id, start_date, end_date);

        logActivity(user.id, user.name, 'طلب إجازة', 'إجازة', undefined, `من ${start_date} إلى ${end_date} (${days} يوم)`);

        res.status(201).json({
            message: 'تم تقديم طلب الإجازة بنجاح',
            id: result.lastInsertRowid,
        });
    } catch (err) {
        res.status(500).json({ error: 'حدث خطأ أثناء تقديم الطلب' });
    }
});

// PUT /api/leaves/:id/approve - Approve leave (manager only)
router.put('/:id/approve', requireManager, (req: Request, res: Response) => {
    const { id } = req.params;
    const manager = req.session.user!;
    const leave = db.prepare('SELECT l.*, e.name as employee_name FROM leaves l JOIN employees e ON l.employee_id = e.id WHERE l.id = ?').get(Number(id)) as any;

    if (!leave) {
        res.status(404).json({ error: 'طلب الإجازة غير موجود' });
        return;
    }

    if (leave.status !== 'pending') {
        res.status(400).json({ error: 'لا يمكن تعديل حالة هذا الطلب' });
        return;
    }

    const days = calcDays(leave.start_date, leave.end_date);

    // Deduct from balance
    db.prepare('UPDATE employees SET annual_leave_balance = annual_leave_balance - ? WHERE id = ?').run(days, leave.employee_id);
    db.prepare("UPDATE leaves SET status = 'approved' WHERE id = ?").run(Number(id));

    logActivity(manager.id, manager.name, 'موافقة على إجازة', 'إجازة', leave.employee_name, `${days} يوم`);

    res.json({ message: 'تمت الموافقة على الإجازة' });
});

// PUT /api/leaves/:id/reject - Reject leave (manager only)
router.put('/:id/reject', requireManager, (req: Request, res: Response) => {
    const { id } = req.params;
    const manager = req.session.user!;
    const leave = db.prepare('SELECT l.*, e.name as employee_name FROM leaves l JOIN employees e ON l.employee_id = e.id WHERE l.id = ?').get(Number(id)) as any;

    if (!leave) {
        res.status(404).json({ error: 'طلب الإجازة غير موجود' });
        return;
    }

    // If was approved, refund balance
    if (leave.status === 'approved') {
        const days = calcDays(leave.start_date, leave.end_date);
        db.prepare('UPDATE employees SET annual_leave_balance = annual_leave_balance + ? WHERE id = ?').run(days, leave.employee_id);
    }

    db.prepare("UPDATE leaves SET status = 'rejected' WHERE id = ?").run(Number(id));

    logActivity(manager.id, manager.name, 'رفض إجازة', 'إجازة', leave.employee_name);

    res.json({ message: 'تم رفض الإجازة' });
});

// DELETE /api/leaves/:id - Delete leave (manager only)
router.delete('/:id', requireManager, (req: Request, res: Response) => {
    const { id } = req.params;
    const manager = req.session.user!;
    const leave = db.prepare('SELECT l.*, e.name as employee_name FROM leaves l JOIN employees e ON l.employee_id = e.id WHERE l.id = ?').get(Number(id)) as any;

    if (!leave) {
        res.status(404).json({ error: 'طلب الإجازة غير موجود' });
        return;
    }

    // If was approved, refund balance
    if (leave.status === 'approved') {
        const days = calcDays(leave.start_date, leave.end_date);
        db.prepare('UPDATE employees SET annual_leave_balance = annual_leave_balance + ? WHERE id = ?').run(days, leave.employee_id);
    }

    db.prepare('DELETE FROM leaves WHERE id = ?').run(Number(id));

    logActivity(manager.id, manager.name, 'حذف إجازة', 'إجازة', leave.employee_name);

    res.json({ message: 'تم حذف الإجازة' });
});

export default router;
