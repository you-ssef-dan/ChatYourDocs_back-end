// src/controllers/chatbotController.ts

import { Request, Response } from 'express';
import * as chatbotService from '../services/chatbotService';
import axios from 'axios';
import FormData from 'form-data';
import { uploadFileToS3, deleteFilesFromS3, deleteFolderFromS3} from '../services/s3Service';

// Define MulterFile type for better type safety
type MulterFile = {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

export async function createChatbot(req: Request, res: Response) {
  let createdChatbot: any = null;
  const uploadedS3Keys: string[] = [];

  try {
    const { name } = req.body;
    const user = (req as any).user;

    if (!user?.uid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 1) Create chatbot record in DB
    createdChatbot = await chatbotService.createChatbot({
      name,
      userId: user.uid,
    });
    console.log(`Created chatbot id=${createdChatbot.id} in DB`);

    const files = (req.files as MulterFile[]) || [];

    // 2) Upload files to S3 safely
    console.log(`Uploading ${files.length} files to S3`);
    for (const f of files) {
      const key = `users/user${user.uid}/chatbot${createdChatbot.id}/documents/${f.originalname}`;
      try {
        await uploadFileToS3(key, f.buffer, f.mimetype);
        uploadedS3Keys.push(key); // track only successful uploads
      } catch (s3Err) {
        console.error(`Failed to upload ${f.originalname} to S3`, s3Err);
        throw new Error(`S3 upload failed for file: ${f.originalname}`);
      }
    }
    console.log(`Uploaded ${uploadedS3Keys.length} files to S3`);

    // 3) Send files to Python service
    console.log('Calling Python service to process files');
    const form = new FormData();
    form.append('name', name);
    form.append('chatbot_id', String(createdChatbot.id));
    for (const f of files) {
      form.append('files', f.buffer, {
        filename: f.originalname,
        contentType: f.mimetype,
        knownLength: f.size,
      } as any);
    }

    const pythonUrl = process.env.PYTHON_SERVICE_URL
      ? `${process.env.PYTHON_SERVICE_URL.replace(/\/$/, '')}/chatbots`
      : 'http://localhost:8000/chatbots';

    const headers = { ...form.getHeaders(), 'X-User-Id': String(user.uid) };

    try {
      console.log(`Sending request to Python service at ${pythonUrl}`);
      const pythonResp = await axios.post(pythonUrl, form, { headers });
      console.log('Python service response status:', pythonResp.status);
      if (pythonResp.status < 200 || pythonResp.status >= 300) {
        throw new Error(`Python service returned status ${pythonResp.status}`);
      }
    } catch (pythonErr: any) {
      console.error('Python service call failed:', pythonErr);

      // Rollback: delete uploaded S3 files and DB record
      if (uploadedS3Keys.length > 0) {
        try {
          await deleteFilesFromS3(uploadedS3Keys);
          console.info(`Rolled back ${uploadedS3Keys.length} S3 files`);
        } catch (s3DelErr) {
          console.error('Failed to delete S3 objects during rollback:', s3DelErr);
        }
      }

      if (createdChatbot?.id) {
        try {
          await chatbotService.deleteChatbot(createdChatbot.id);
          console.info(`Rolled back chatbot id=${createdChatbot.id}`);
        } catch (dbDelErr) {
          console.error('Failed to delete chatbot during rollback:', dbDelErr);
        }
      }

      return res.status(500).json({ error: 'Failed to create chatbot', detail: pythonErr?.message });
    }

    // 4) Success response
    return res.json({
      message: 'Chatbot created',
      chatbot: createdChatbot,
    });

  } catch (err: any) {
    console.error('createChatbot failed:', err?.message ?? err);

    // Rollback any partial success (S3 uploads / DB record)
    try {
      if (uploadedS3Keys.length > 0) {
        await deleteFilesFromS3(uploadedS3Keys);
        console.info(`Rolled back ${uploadedS3Keys.length} S3 files`);
      }
      if (createdChatbot?.id) {
        await chatbotService.deleteChatbot(createdChatbot.id);
        console.info(`Rolled back chatbot id=${createdChatbot.id}`);
      }
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }

    return res.status(500).json({ error: 'Failed to create chatbot', detail: err?.message });
  }
}

export async function listUserChatbots(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const chatbots = await chatbotService.getChatbotsByUser(user.uid);
    return res.json(chatbots);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function deleteChatbot(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!user?.uid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const chatbotId = Number(id);
    if (Number.isNaN(chatbotId)) {
      return res.status(400).json({ error: 'Invalid chatbot id' });
    }

    try {
      // centralized deletion (S3 -> Python -> DB)
      await chatbotService.deleteChatbotCompletely(chatbotId, user.uid);
    } catch (err: any) {
      console.error('Failed to completely delete chatbot:', err);
      return res.status(500).json({ error: err?.message ?? 'Failed to delete chatbot' });
    }

    return res.json({ message: 'Chatbot and its files deleted' });
  } catch (err: any) {
    console.error('deleteChatbot failed:', err?.message ?? err);
    return res.status(500).json({ error: err?.message ?? 'Failed to delete chatbot' });
  }
}



export async function getChatbotById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const chatbot = await chatbotService.getChatbotById(Number(id), user.uid);

    if (!chatbot) return res.status(404).json({ error: 'Chatbot not found' });

    return res.json(chatbot);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
