import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serverConfig } from './config.js';
import { healthRouter } from './routes/health.routes.js';
import { aiRouter } from './routes/ai.routes.js';
import { referenceRouter } from './routes/reference.routes.js';
import { sandboxSessionRouter } from './routes/sandboxSession.routes.js';

export const app = express();

// Configurable CORS protection
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, or same-origin browser requests)
      if (!origin || serverConfig.corsOrigin === '*') {
        return callback(null, true);
      }
      const allowedOrigins = serverConfig.corsOrigin.split(',').map((o) => o.trim());
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not permitted by CORS`));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
  })
);

// Body parser limits for base64 canvas image payloads
app.use(express.json({ limit: serverConfig.bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: serverConfig.bodyLimit }));

// Request Logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

// Primary API Routes
app.use('/api/health', healthRouter);
app.use('/api/ai', aiRouter);
app.use('/api/reference', referenceRouter);
app.use('/api/sandbox/session', sandboxSessionRouter);

// 404 handler for unknown /api endpoints
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
  });
});

// Production Static Frontend Serving
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  // Serve static assets from production bundle
  app.use(express.static(distPath));

  // Single Page Application (SPA) catch-all fallback for browser navigation
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) {
      return next();
    }
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
} else {
  // Root route fallback when running standalone API without built frontend
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'Draw2Play AI Backend API',
      event: 'Banana Hacks 2026',
      theme: 'Image AI',
      status: 'online',
      endpoints: {
        health: '/api/health',
        analyzeCharacter: 'POST /api/ai/analyze-character',
      },
    });
  });
}

// Centralized error handling
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server Uncaught Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// Start Server and Lifecycle Management
let serverInstance: ReturnType<typeof app.listen> | null = null;

const isDirectRun = Boolean(
  process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() === path.resolve(fileURLToPath(import.meta.url)).toLowerCase()
);

export function startServer(port: number = serverConfig.port): ReturnType<typeof app.listen> {
  if (serverInstance) return serverInstance;
  serverInstance = app.listen(port, () => {
    console.log(`====================================================`);
    console.log(`🍌 Draw2Play AI Backend is running!`);
    console.log(`📍 Port: http://localhost:${port}`);
    console.log(`🤖 Image AI Model: ${serverConfig.geminiModel}`);
    console.log(`🔑 Gemini Key Configured: ${Boolean(serverConfig.geminiApiKey)}`);
    console.log(`📦 Serving Static Frontend: ${fs.existsSync(distPath)}`);
    console.log(`====================================================`);
  });
  return serverInstance;
}

if (isDirectRun && process.env.NODE_ENV !== 'test') {
  startServer();
}

/**
 * Handles graceful shutdown upon process signals (SIGTERM / SIGINT)
 */
export function gracefulShutdown(signal: string): Promise<void> {
  return new Promise((resolve) => {
    console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
    if (serverInstance) {
      serverInstance.close(() => {
        console.log('[Server] HTTP connections closed cleanly.');
        serverInstance = null;
        resolve();
      });
      // Safety timeout to avoid hanging processes
      setTimeout(() => {
        console.warn('[Server] Forced shutdown timeout reached.');
        serverInstance = null;
        resolve();
      }, 5000).unref();
    } else {
      resolve();
    }
  });
}

process.on('SIGTERM', async () => {
  await gracefulShutdown('SIGTERM');
  process.exit(0);
});

process.on('SIGINT', async () => {
  await gracefulShutdown('SIGINT');
  process.exit(0);
});

export default app;
