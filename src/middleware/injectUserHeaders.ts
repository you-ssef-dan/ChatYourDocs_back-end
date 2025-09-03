// src/middleware/injectUserHeaders.ts
import { Request, Response, NextFunction } from "express";

interface AuthRequest extends Request {
  user?: {
    uid: number | string;
    username?: string;
    scope?: string;
  };
}

export function injectUserHeaders(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.user || !req.user.uid) return next();

  const uid = String(req.user.uid);

  // Inject X-User-Id (trusted from JWT)
  req.headers["x-user-id"] = uid;

  // Optional: username and scope
  if (req.user.username) req.headers["x-user-username"] = req.user.username;
  if (req.user.scope) req.headers["x-user-scope"] = req.user.scope;

  next();
}
