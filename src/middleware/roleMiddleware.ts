// src/middleware/roleMiddleware.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';


export function requireRole(role: 'USER' | 'ADMIN') {
return (req: AuthRequest, res: Response, next: NextFunction) => {
const user = req.user;
if (!user) return res.status(401).json({ error: 'Not authenticated' });
const scope = (user.scope || '').split(/\s+/).filter(Boolean);
if (scope.includes(role)) return next();
return res.status(403).json({ error: 'Forbidden - missing role ' + role });
};
}