import dotenv from 'dotenv';

dotenv.config();

export const ENV = {
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  TYPESAFE_API_KEY: process.env.TYPESAFE_API_KEY || '',
  AI_DETECTIVE_POLICY: (process.env.AI_DETECTIVE_POLICY || 'choose') as 'jev' | 'heuristic' | 'choose',
  AI_CHOICE_TIMEOUT_MS: parseInt(process.env.AI_CHOICE_TIMEOUT_MS || '30000', 10),
  JEV_MODEL: process.env.JEV_MODEL || 'jev-latest',
  JEV_TIMEOUT_MS: parseInt(process.env.JEV_TIMEOUT_MS || '4000', 10),
  JEV_MIN_CONFIDENCE: parseFloat(process.env.JEV_MIN_CONFIDENCE || '0'),
  DATABASE_URL: process.env.DATABASE_URL || '',
  FRONTEND_URL: process.env.FRONTEND_URL || '',
  HOST: process.env.HOST || '0.0.0.0',
  PORT: parseInt(process.env.PORT || '3000', 10),
};
