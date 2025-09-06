// src/services/userService.ts
import prisma from '../config/database';
import { hashPassword } from '../utils/hash';
import { Role } from '@prisma/client';
import * as chatbotService from './chatbotService';

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  role?: string; // e.g., "ADMIN" or "USER" or space-separated
}

function validateEmail(email: string) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export async function registerUser(input: RegisterInput) {
  if (!input.username) throw new Error('Username is required');
  if (!input.email) throw new Error('Email is required');
  if (!validateEmail(input.email)) throw new Error('Invalid email format');
  if (!input.password) throw new Error('Password is required');

  // Do NOT enforce username uniqueness (username is not unique now)
  // Only ensure email uniqueness
  const existsByEmail = await prisma.user.findUnique({ where: { email: input.email } });
  if (existsByEmail) throw new Error('Email already exists');

  const roleInput = (input.role || 'USER').trim().toUpperCase();
  const split = roleInput.split(/\s+/).filter(Boolean);
  const roles: Role[] = [];
  for (const r of split) {
    if (r === 'ADMIN') {
      roles.push('ADMIN');
      if (!roles.includes('USER')) roles.push('USER');
    } else if (r === 'USER') {
      if (!roles.includes('USER')) roles.push('USER');
    } else {
      throw new Error('Invalid role: ' + r);
    }
  }

  const hashed = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      password: hashed,
      roles,
    },
  });

  return user;
}

export async function getAllUsers() {
  const users = await prisma.user.findMany();
  return users.map(u => ({ id: u.id, username: u.username, email: u.email, roles: u.roles }));
}

export async function deleteUser(id: number) {
  const chatbots = await chatbotService.getChatbotsIdsByUser(id); // expects [{ id }]
  const failures: Array<{ chatbotId: number; error: string }> = [];

  for (const cb of chatbots) {
    const chatbotId = cb.id;
    try {
      await chatbotService.deleteChatbotCompletely(chatbotId, id);
    } catch (err: any) {
      console.error(`Failed to delete chatbot ${chatbotId} for user ${id}:`, err);
      failures.push({ chatbotId, error: err?.message ?? String(err) });
      break;
    }
  }

  if (failures.length > 0) {
    throw new Error(`Failed to delete chatbots for user ${id}: ${JSON.stringify(failures)}`);
  }

  await prisma.user.delete({ where: { id } });
}

export async function findUserByUsername(username: string) {
  // username is not unique anymore — return the first match
  return prisma.user.findFirst({ where: { username } });
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}
