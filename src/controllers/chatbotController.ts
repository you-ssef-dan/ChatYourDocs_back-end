// src/controllers/chatbotController.ts
import { Request, Response } from 'express';
import * as chatbotService from '../services/chatbotService';
import axios from 'axios';
import FormData from 'form-data';
import { uploadFileToS3, deleteFilesFromS3 } from '../services/s3Service';

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

    const files = (req.files as MulterFile[]) || [];
    for (const f of files) {
      // normalize filename to avoid weird chars in key
      const safeName = f.originalname.replace(/\s+/g, '_');
      const key = `users/user${user.uid}/chatbot${createdChatbot.id}/documents/${f.originalname}`;
      await uploadFileToS3(key, f.buffer, f.mimetype);
      uploadedS3Keys.push(key);
    }

    // 3) Prepare form-data with buffers to send to Python (keeps your existing behavior)
    const form = new FormData();
    form.append('name', name);
    form.append('chatbot_id', String(createdChatbot.id));

    for (const f of (req.files as MulterFile[]) || []) {
      form.append('files', f.buffer, {
        filename: f.originalname,
        contentType: f.mimetype,
        knownLength: f.size,
      } as any);
    }

    // 4) Send to Python service
    const pythonUrl = process.env.PYTHON_SERVICE_URL
      ? `${process.env.PYTHON_SERVICE_URL.replace(/\/$/, '')}/chatbots`
      : 'http://localhost:8000/chatbots';

    const headers = {
      ...form.getHeaders(),
      'X-User-Id': String(user.uid), // Python expects X-User-Id header
    };

    const pythonResp = await axios.post(pythonUrl, form, {
      headers
    });

    // 5) Respond with combined result (no S3 metadata stored in DB)
    return res.json({
      message: 'Chatbot created',
      chatbot: createdChatbot,
      python: pythonResp.data,
    });

  } catch (err: any) {
    console.error('createChatbot failed:', err?.message ?? err);

    // Attempt cleanup:
    //  - delete uploaded S3 files (if any)
    //  - delete DB record (if created)
    try {
      if (uploadedS3Keys.length > 0) {
        try {
          await deleteFilesFromS3(uploadedS3Keys);
          console.info(`Deleted ${uploadedS3Keys.length} uploaded S3 objects due to failure.`);
        } catch (s3DelErr) {
          console.error('Failed to delete S3 objects during rollback:', s3DelErr);
        }
      }

      if (createdChatbot?.id) {
        await chatbotService.deleteChatbot(createdChatbot.id);
        console.info(`Rolled back chatbot id=${createdChatbot.id}`);
      }
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }

    // Return an error to client. Include Python response body if available.
    const pythonMessage = err?.response?.data || err?.message;
    return res.status(500).json({ error: 'Failed to create chatbot', detail: pythonMessage });
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
    await chatbotService.deleteChatbot(Number(id));
    return res.json({ message: 'Chatbot deleted' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
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
