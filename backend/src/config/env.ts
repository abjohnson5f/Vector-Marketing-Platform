import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().startsWith('postgresql://'),
  
  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  
  // Meta OAuth
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_REDIRECT_URI: z.string().optional(),
  
  // Gemini AI
  GEMINI_API_KEY: z.string().optional(),
  
  // Token encryption
  ENCRYPTION_KEY: z.string().min(32).optional(),
  
  // Server
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  // In development, load from process.env directly (tsx handles .env)
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.flatten().fieldErrors);
    
    // In development, allow partial env for easier setup
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ Running with partial config in development mode');
      return envSchema.parse({
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/vector_marketing',
      });
    }
    
    throw new Error('Invalid environment configuration');
  }
  
  return result.data;
}

export const env = loadEnv();

