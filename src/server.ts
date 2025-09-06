// src/server.ts
import dotenv from 'dotenv';
import http from 'http';
import app from './app';
import prisma from './config/database';
import { registerUser } from './services/userService';

dotenv.config();

const PORT = parseInt(process.env.PORT || '8085', 10);

/**
 * Keep a reference to the HTTP server so we can close it on shutdown.
 */
let server: http.Server | null = null;

async function createDefaultAdmin() {
  try {
    await registerUser({ username: 'admin',email : 'admin@gmail.com',  password: '12345', role: 'ADMIN' });
    console.log('✅ Default admin user created: admin@gmail.com / 12345');
  } catch (err: any) {
    // If the user exists or any expected error happens, log info and continue.
    console.log('ℹ️ Admin user creation skipped: ' + (err?.message ?? String(err)));
  }
}

async function start() {
  try {
    // Connect Prisma
    await prisma.$connect();
    console.log('🔌 Prisma connected');

    // Create default admin (non-blocking for server start, but awaited here to preserve original behavior)
    await createDefaultAdmin();

    // Create HTTP server from express app for better control over shutdown
    server = http.createServer(app);

    server.listen(PORT, () => {
      console.log(`🚀 Server listening on http://localhost:${PORT}`);
    });

    // Graceful shutdown handlers
    const shutdown = async (signal: string) => {
      try {
        console.log(`\n⚠️ Received ${signal} - closing server...`);
        if (server) {
          // stop accepting new connections
          server.close((err) => {
            if (err) {
              console.error('Error while closing HTTP server:', err);
            } else {
              console.log('HTTP server closed');
            }
          });
        }

        // disconnect prisma
        await prisma.$disconnect();
        console.log('🔌 Prisma disconnected');

        process.exit(0);
      } catch (shutdownErr) {
        console.error('Error during shutdown', shutdownErr);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // prevent unhandled rejections from leaving the process in an inconsistent state
    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled Rejection at:', reason);
    });

    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception thrown:', err);
      // it's safer to exit after an uncaught exception; allow exit handlers to run
      process.exit(1);
    });
  } catch (err) {
    console.error('Failed to start server', err);
    try {
      await prisma.$disconnect();
    } catch (_) {
      // ignore
    }
    process.exit(1);
  }
}

start();
