import dotenv from 'dotenv';

dotenv.config();

export const ENV = {
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  DATABASE_URL: process.env.DATABASE_URL || '',
  FRONTEND_URL: process.env.FRONTEND_URL || '',
  HOST: process.env.HOST || '0.0.0.0',
  PORT: parseInt(process.env.PORT || '3000', 10),
};
