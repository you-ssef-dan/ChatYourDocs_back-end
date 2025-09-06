// src/controllers/authController.ts
import { Request, Response } from 'express';
import * as userService from '../services/userService';
import { verifyPassword } from '../utils/hash';
import { signJwt } from '../config/jwt';

export async function register(req: Request, res: Response) {
  try {
    const { username, email, password, role } = req.body;
    const user = await userService.registerUser({ username, email, password, role });
    return res.json({
      message: 'User registered successfully',
      username: user.username,
      email: user.email,
      roles: user.roles,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

export async function addUser(req: Request, res: Response) {
  try {
    const { username, email, password, role } = req.body;
    const user = await userService.registerUser({ username, email, password, role });
    return res.json({
      message: 'User registered successfully',
      username: user.username,
      email: user.email,
      roles: user.roles,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const email = req.body.email;
    const password = req.body.password;

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' });
    }

    const user = await userService.findUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const ok = await verifyPassword(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    const scope = (user.roles || []).join(' ');
    const token = signJwt({ sub: user.username, email: user.email, scope, uid: user.id });
    return res.json({ token });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await userService.deleteUser(Number(id));
    return res.json({ message: 'User deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function publicEndpoint(req: Request, res: Response) {
  return res.json({ message: 'Hello from public endpoint' });
}

export async function userEndpoint(req: Request, res: Response) {
  const user = (req as any).user;
  return res.json({ message: `Hello ${user?.username}`, username: user?.username, email: user?.email });
}

export async function listUsers(req: Request, res: Response) {
  const users = await userService.getAllUsers();
  return res.json(users);
}
