import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { serverConfig } from './config.js';
import { healthRouter } from './routes/health.routes.js';
import { aiRouter } from './routes/ai.routes.js';
import { referenceRouter } from './routes/reference.routes.js';
import { sandboxSessionRouter } from './routes/sandboxSession.routes.js';

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
}));

// Increased limit for base64 canvas image payloads
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Request Logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/health', healthRouter);
app.use('/api/ai', aiRouter);
app.use('/api/reference', referenceRouter);
app.use('/api/sandbox/session', sandboxSessionRouter);

// Root route
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

// Centralized error handling
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server Uncaught Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// Start Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(serverConfig.port, () => {
    console.log(`====================================================`);
    console.log(`🍌 Draw2Play AI Backend is running!`);
    console.log(`📍 Port: http://localhost:${serverConfig.port}`);
    console.log(`🤖 Image AI Model: ${serverConfig.geminiModel}`);
    console.log(`🔑 Gemini Key Configured: ${Boolean(serverConfig.geminiApiKey)}`);
    console.log(`====================================================`);
  });
}

export default app;
