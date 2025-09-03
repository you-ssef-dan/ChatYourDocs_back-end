// src/routes/authRoutes.ts
import { Router } from 'express';
import * as controller from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';


const router = Router();


router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/addUser', authenticateToken, requireRole('ADMIN'), controller.addUser);
router.get('/public', controller.publicEndpoint);
router.get('/user', authenticateToken, requireRole('USER'), controller.userEndpoint);
router.get('/users', authenticateToken, requireRole('ADMIN'), controller.listUsers);


export default router;