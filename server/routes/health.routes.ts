import { Router, Request, Response } from 'express';
import { serverConfig } from '../config.js';

export const healthRouter = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    project: 'Draw2Play AI',
    hackathon: 'Banana Hacks 2026',
    theme: 'Image AI',
    aiProvider: serverConfig.geminiApiKey ? 'Gemini 3.8 Flash' : 'Mock Heuristic Fallback (Ready for GEMINI_API_KEY)',
    geminiConfigured: Boolean(serverConfig.geminiApiKey),
    timestamp: new Date().toISOString(),
  });
});
