import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const ServerConfigSchema = z.object({
  port: z.coerce.number().default(3001),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  geminiApiKey: z.string().optional(),
  geminiModel: z.string().default('gemini-3.8-flash'),
  frontendUrl: z.string().default('http://localhost:5173'),
});

export const serverConfig = ServerConfigSchema.parse({
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
});
