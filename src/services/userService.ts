// src/services/userService.ts
import prisma from '../config/database';
import { hashPassword } from '../utils/hash';
import { Role } from '@prisma/client';


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


export async function findUserByUsername(username: string) {
return prisma.user.findUnique({ where: { username } });
}