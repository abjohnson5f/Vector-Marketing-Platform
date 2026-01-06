import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().startsWith('postgresql://'),
  
  // Redis (for BullMQ + rate limiting)
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // Google OAuth (for GA4 / Search Console)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  
  // Google Ads API
  GOOGLE_ADS_DEVELOPER_TOKEN: z.string().optional(),
  GOOGLE_ADS_LOGIN_CUSTOMER_ID: z.string().optional(), // MCC account ID
  GOOGLE_ADS_CUSTOMER_ID: z.string().optional(), // Target customer ID(s)
  
  // Google Search Console
  GSC_SITE_URL: z.string().optional(), // e.g., https://example.com or sc-domain:example.com
  
  // Meta OAuth
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_REDIRECT_URI: z.string().optional(),
  
  // Gemini AI
  GEMINI_API_KEY: z.string().optional(),
  
  // DataForSEO
  DATAFORSEO_LOGIN: z.string().optional(),
  DATAFORSEO_PASSWORD: z.string().optional(),
  
  // PageSpeed Insights
  PAGESPEED_API_KEY: z.string().optional(),
  
  // GTM Configuration
  GTM_CONTAINER_ID: z.string().optional(), // e.g., GTM-XXXXXXX
  GTM_SERVER_URL: z.string().optional(), // e.g., https://sgtm.yourdomain.com
  
  // GA4 Measurement
  GA4_MEASUREMENT_ID: z.string().optional(), // e.g., G-XXXXXXXXXX
  GA4_API_SECRET: z.string().optional(), // For Measurement Protocol
  
  // Server-side GTM endpoint
  SGTM_ENDPOINT: z.string().optional(), // e.g., https://sgtm.yourdomain.com
  
  // Google Ads Conversions
  GOOGLE_ADS_CONVERSION_ID: z.string().optional(),
  GOOGLE_ADS_CONVERSION_LABEL: z.string().optional(),
  
  // Google Service Account (for Indexing API)
  // JSON string of service account credentials
  GOOGLE_SERVICE_ACCOUNT_KEY: z.string().optional(),
  
  // Token encryption
  ENCRYPTION_KEY: z.string().min(32).optional(),
  
  // Server
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // App Domain (for CORS and callbacks)
  APP_DOMAIN: z.string().default('localhost'),
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

// Helper to check if a feature is configured
export function hasGoogleAds(): boolean {
  return !!(env.GOOGLE_ADS_DEVELOPER_TOKEN && env.GOOGLE_ADS_CUSTOMER_ID);
}

export function hasSearchConsole(): boolean {
  return !!(env.GOOGLE_CLIENT_ID && env.GSC_SITE_URL);
}

export function hasDataForSEO(): boolean {
  return !!(env.DATAFORSEO_LOGIN && env.DATAFORSEO_PASSWORD);
}

export function hasPageSpeed(): boolean {
  return !!env.PAGESPEED_API_KEY;
}

export function hasGTM(): boolean {
  return !!env.GTM_CONTAINER_ID;
}
