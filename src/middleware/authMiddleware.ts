// src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { verifyJwt } from '../config/jwt';


export interface AuthRequest extends Request {
  user?: { uid: number; username: string; scope?: string };
}


export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  console.log('Auth header:', req.headers['authorization']);
const auth = req.headers['authorization'];
if (!auth) return res.status(401).json({ error: 'Missing Authorization header' });


const parts = (auth as string).split(' ');
if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Invalid Authorization header' });


const token = parts[1];
try {
const payload: any = await verifyJwt(token, {} as any) as any;

req.user = {
      uid: payload.uid,       // 👈 renamed
      username: payload.sub,
      scope: payload.scope,
    };

next();
} catch (err) {
return res.status(401).json({ error: 'Invalid or expired token', details: String(err) });
}
}