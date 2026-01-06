/**
 * Standalone Worker Process
 * 
 * This script starts the BullMQ workers for processing sync jobs, SEO jobs, and web vitals.
 * Run with: npx tsx src/worker.ts
 * 
 * In production, use PM2:
 *   pm2 start ecosystem.config.cjs --only vector-marketing-worker
 */

import 'dotenv/config';
import { startWorkers, scheduleRecurringSyncs } from './jobs/sync-worker.js';
import { logger } from './lib/logger.js';
import { env } from './config/env.js';

async function main() {
  logger.info({ env: env.NODE_ENV, redisUrl: env.REDIS_URL.replace(/:[^:@]+@/, ':***@') }, '🔄 Starting Vector Marketing Worker');
  
  try {
    // Start all worker processes
    startWorkers();
    
    // Schedule recurring syncs if in production
    if (env.NODE_ENV === 'production') {
      logger.info('Scheduling recurring sync jobs...');
      await scheduleRecurringSyncs();
    }
    
    logger.info('✅ Worker is running and processing jobs');
    
    // Keep the process alive
    process.on('SIGINT', () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      process.exit(0);
    });
    
  } catch (err) {
    logger.error({ error: err }, 'Failed to start worker');
    process.exit(1);
  }
}

main();




