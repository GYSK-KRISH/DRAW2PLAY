import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

export const ServerConfigSchema = z.object({
  port: z.coerce.number().int().min(1).max(65535).default(3001),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  geminiApiKey: z.string().optional(),
  geminiModel: z.string().default('gemini-3.8-flash'),
  geminiTimeoutMs: z.coerce.number().int().min(5000).max(120000).default(35000),
  hfToken: z.string().optional(),
  hfVisionModel: z.string().default('Qwen/Qwen2.5-VL-3B-Instruct'),
  hfTimeoutMs: z.coerce.number().int().min(5000).max(120000).default(35000),
  frontendUrl: z.string().default('http://localhost:5173'),
  corsOrigin: z.string().default('*'),
  bodyLimit: z.string().default('15mb'),
});

export const serverConfig = ServerConfigSchema.parse({
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  geminiTimeoutMs: process.env.GEMINI_TIMEOUT_MS ? Number(process.env.GEMINI_TIMEOUT_MS) : 35000,
  hfToken: process.env.HF_TOKEN,
  hfVisionModel: process.env.HF_VISION_MODEL || 'Qwen/Qwen2.5-VL-3B-Instruct',
  hfTimeoutMs: process.env.HF_TIMEOUT_MS ? Number(process.env.HF_TIMEOUT_MS) : 35000,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  bodyLimit: process.env.BODY_LIMIT || '15mb',
});
