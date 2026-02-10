import { Router, Request, Response } from 'express';
import db, { logActivity } from '../database';
import { requireAuth, requireManager } from '../middleware/auth';

const router = Router();

// GET /api/stats - Dashboard statistics (manager only)
router.get('/', requireManager, (req: Request, res: Response) => {
    try {
        const totalEmployees = (db.prepare('SELECT COUNT(*) as count FROM employees').get() as any).count;
        const supervisors = (db.prepare("SELECT COUNT(*) as count FROM employees WHERE role = 'supervisor'").get() as any).count;
        const operators = (db.prepare("SELECT COUNT(*) as count FROM employees WHERE role = 'operator'").get() as any).count;

        const pendingLeaves = (db.prepare("SELECT COUNT(*) as count FROM leaves WHERE status = 'pending'").get() as any).count;
        const approvedLeaves = (db.prepare("SELECT COUNT(*) as count FROM leaves WHERE status = 'approved'").get() as any).count;
        const totalCourses = (db.prepare('SELECT COUNT(*) as count FROM courses').get() as any).count;
        const totalMandates = (db.prepare('SELECT COUNT(*) as count FROM mandates').get() as any).count;

        // Employees by shift
        const byShift = db.prepare(`
            SELECT shift, COUNT(*) as count FROM employees 
            WHERE role != 'manager' AND shift IS NOT NULL 
            GROUP BY shift ORDER BY shift
        `).all();

        // Recent leaves
        const recentLeaves = db.prepare(`
            SELECT l.*, e.name as employee_name, e.shift as employee_shift
            FROM leaves l JOIN employees e ON l.employee_id = e.id
            ORDER BY l.created_at DESC LIMIT 5
        `).all();

        res.json({
            totalEmployees,
            supervisors,
            operators,
            pendingLeaves,
            approvedLeaves,
            totalCourses,
            totalMandates,
            byShift,
            recentLeaves,
        });
    } catch (err) {
        res.status(500).json({ error: 'خطأ في تحميل الإحصائيات' });
    }
});

// GET /api/stats/activity - Activity log (manager only)
router.get('/activity', requireManager, (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const activities = db.prepare(`
            SELECT * FROM activity_log 
            ORDER BY created_at DESC 
            LIMIT ?
        `).all(limit);
        res.json(activities);
    } catch (err) {
        res.status(500).json({ error: 'خطأ في تحميل سجل النشاطات' });
    }
});

export default router;
