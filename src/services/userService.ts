// src/services/userService.ts
import prisma from '../config/database';
import { hashPassword } from '../utils/hash';
import { Role } from '@prisma/client';
import * as chatbotService from './chatbotService'; // add this near top of userService.ts



export interface RegisterInput {
username: string;
password: string;
role?: string; // e.g., "ADMIN" or "USER" or space-separated
}


export async function registerUser(input: RegisterInput) {
const exists = await prisma.user.findUnique({ where: { username: input.username } });
if (exists) throw new Error('Username already exists');


const roleInput = (input.role || 'USER').trim().toUpperCase();
const split = roleInput.split(/\s+/).filter(Boolean);
const roles: Role[] = [];
for (const r of split) {
if (r === 'ADMIN') {
roles.push('ADMIN');
// ensure USER included
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
password: hashed,
roles,
},
});


return user;
}


export async function getAllUsers() {
const users = await prisma.user.findMany();
return users.map(u => ({ id: u.id, username: u.username, roles: u.roles }));
}

export async function deleteUser(id: number) {
  // 1) fetch chatbots for this user
  const chatbots = await chatbotService.getChatbotsIdsByUser(id); // or use chatbotService.getChatbotsIdsByUser
  // chatbots is array of { id: number }

  const failures: Array<{ chatbotId: number; error: string }> = [];

  // delete each chatbot sequentially (safer to observe failures). adjust concurrency if you want parallelism.
  for (const cb of chatbots) {
    const chatbotId = cb.id;
    try {
      await chatbotService.deleteChatbotCompletely(chatbotId, id);
    } catch (err: any) {
      console.error(`Failed to delete chatbot ${chatbotId} for user ${id}:`, err);
      failures.push({ chatbotId, error: err?.message ?? String(err) });
      // stop on first failure to avoid partial deletions and keep consistent state:
      break;
    }
  }

  if (failures.length > 0) {
    // Do not delete user if chatbots couldn't be removed cleanly.
    throw new Error(`Failed to delete chatbots for user ${id}: ${JSON.stringify(failures)}`);
  }

  // 2) delete the user (all chatbots already removed)
  await prisma.user.delete({ where: { id } });
}



export async function findUserByUsername(username: string) {
return prisma.user.findUnique({ where: { username } });
}