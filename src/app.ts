// src/app.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import chatbotRoutes from './routes/chatbotRoutes';
import { authenticateToken } from './middleware/authMiddleware';
import { injectUserHeaders } from './middleware/injectUserHeaders';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config();

const app = express();

// Middlewares
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    
  })
);

// Built-in body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request logger (avoids adding extra dependency like morgan)
app.use((req: Request, _res: Response, next: NextFunction) => {
  const now = new Date().toISOString();
  console.log(`[${now}] ${req.method} ${req.originalUrl}`);
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/chatbots', chatbotRoutes);

// Proxy middleware for Python service with authentication and user header injection
app.use(
  "/python-api",
  authenticateToken,   //  verify JWT
  injectUserHeaders,   //  inject decoded user info into headers
  createProxyMiddleware({
    target: "http://localhost:8000",   //  forward to Python service
    changeOrigin: true,                 //  rewrite Host header for backend
    pathRewrite: { "^/python-api": "" } //  remove "/python-api" prefix
  })
);


// Health check / root
app.get('/', (_req: Request, res: Response) => {
  res.status(200).send('ChatYourDocs Express API');
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

// Centralized error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  const status = (err as any)?.status || 500;
  const message = (err as any)?.message || 'Internal Server Error';
  res.status(status).json({ error: message });
});

export default app;
