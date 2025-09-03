// src/services/chatbotService.ts
import prisma from '../config/database';

export interface CreateChatbotInput {
  name: string;
  userId: number;
}

export async function createChatbot(input: CreateChatbotInput) {
  return prisma.chatbot.create({
    data: {
      name: input.name,
      userId: input.userId,
    },
  });
}

export async function getChatbotsByUser(userId: number) {
  return prisma.chatbot.findMany({
    where: { userId },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });
}
export async function deleteChatbot(id: number) {
  return prisma.chatbot.delete({
    where: { id },
  });
}

export async function getChatbotById(id: number, userId: number) {
  return prisma.chatbot.findFirst({
    where: { id, userId },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });
}

