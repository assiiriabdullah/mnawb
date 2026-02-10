import { Request, Response, NextFunction } from 'express';

// Extend session to include user data
declare module 'express-session' {
    interface SessionData {
        user?: {
            id: number;
            name: string;
            username: string;
            role: 'manager' | 'supervisor' | 'operator';
            shift: string | null;
        };
    }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    if (!req.session.user) {
        res.status(401).json({ error: 'غير مصرح - يرجى تسجيل الدخول' });
        return;
    }
    next();
}

export function requireManager(req: Request, res: Response, next: NextFunction): void {
    if (!req.session.user) {
        res.status(401).json({ error: 'غير مصرح - يرجى تسجيل الدخول' });
        return;
    }
    if (req.session.user.role !== 'manager') {
        res.status(403).json({ error: 'غير مصرح - صلاحية المدير فقط' });
        return;
    }
    next();
}
