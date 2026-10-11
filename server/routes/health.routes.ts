import { Router, Request, Response } from 'express';
import { aiProviderRegistry } from '../providers/index.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  const geminiProvider = aiProviderRegistry.getProvider('gemini');
  const isConfigured = geminiProvider ? geminiProvider.isConfigured() : false;

  res.json({
    status: 'ok',
    project: 'Draw2Play AI',
    hackathon: 'Banana Hacks 2026',
    theme: 'Image AI',
    aiProvider: isConfigured ? 'Gemini 3.8 Flash' : 'Mock Heuristic Fallback (Ready for GEMINI_API_KEY)',
    geminiConfigured: isConfigured,
    providers: await aiProviderRegistry.getProviderStatuses(false),
    timestamp: new Date().toISOString(),
  });
});
