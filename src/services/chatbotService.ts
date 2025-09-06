// src/services/chatbotService.ts
import prisma from '../config/database';
import axios from 'axios';
import FormData from 'form-data';
import { deleteFolderFromS3 } from './s3Service';

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

export async function getChatbotsIdsByUser(userId: number) {
  return prisma.chatbot.findMany({
    where: { userId },
    select: { id: true },
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

/**
 * Delete all assets and database record for a chatbot.
 * Steps:
 *  1) delete files from S3 prefix users/user{userId}/chatbot{chatbotId}/
 *  2) call python service /delete with chatbot_id in form and X-User-Id header
 *  3) delete DB record
 *
 * Throws on any failure; caller decides how to handle.
 */
export async function deleteChatbotCompletely(chatbotId: number, userId: number) {
  // 1) delete S3 objects under chatbot prefix
  const prefix = `users/user${userId}/chatbot${chatbotId}/`;
  try {
    await deleteFolderFromS3(prefix);
    console.info(`S3 objects deleted for prefix: ${prefix}`);
  } catch (s3Err) {
    console.error('Failed to delete S3 objects for chatbot:', s3Err);
    throw new Error(`Failed to delete S3 objects for chatbot: ${s3Err instanceof Error ? s3Err.message : String(s3Err)}`);
  }

  // 2) notify Python service to delete vector DB / ingestion artifacts
  try {
    const form = new FormData();
    form.append('chatbot_id', String(chatbotId));

    const pythonDeleteUrl = process.env.PYTHON_SERVICE_URL
      ? `${process.env.PYTHON_SERVICE_URL.replace(/\/$/, '')}/delete`
      : 'http://localhost:8000/delete';

    const headers = {
      ...form.getHeaders(),
      'X-User-Id': String(userId),
    };

    const pythonResp = await axios.post(pythonDeleteUrl, form, { headers });
    if (pythonResp.status < 200 || pythonResp.status >= 300) {
      throw new Error(`Python service returned status ${pythonResp.status}`);
    }
    console.info(`Python service acknowledged deletion for chatbot ${chatbotId}`);
  } catch (pythonErr: any) {
    console.error('Python service delete call failed:', pythonErr?.message ?? pythonErr);
    throw new Error(`Failed to notify Python service to delete chatbot data: ${pythonErr?.message ?? String(pythonErr)}`);
  }

  // 3) delete DB record
  try {
    await deleteChatbot(chatbotId);
    console.info(`Chatbot DB record deleted: id=${chatbotId}`);
  } catch (dbErr) {
    console.error('Failed to delete chatbot DB record:', dbErr);
    // at this point S3 + Python succeeded but DB deletion failed — caller must handle this inconsistent state
    throw new Error(`Failed to delete chatbot DB record: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
  }
}
