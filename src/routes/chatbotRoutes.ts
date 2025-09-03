// src/routes/chatbotRoutes.ts

import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import {
  listUserChatbots,
  createChatbot,
  deleteChatbot,
  getChatbotById
} from '../controllers/chatbotController';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() }); // <-- store in memory
const router = Router();

// All routes here require authentication
router.use(authenticateToken);

router.get('/my', listUserChatbots);
router.post('/', upload.array('files'), createChatbot);
router.delete('/delete/:id', deleteChatbot);
router.get('/:id', getChatbotById);

export default router;
