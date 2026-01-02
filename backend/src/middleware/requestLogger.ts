import { createMiddleware } from 'hono/factory';
import { logger } from '../lib/logger.js';

export const requestLoggerMiddleware = createMiddleware(async (c, next) => {
  const start = Date.now();
  const requestId = c.get('requestId');
  
  logger.info({
    requestId,
    method: c.req.method,
    path: c.req.path,
    userAgent: c.req.header('user-agent'),
  }, 'Incoming request');
  
  await next();
  
  const duration = Date.now() - start;
  
  logger.info({
    requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration: `${duration}ms`,
  }, 'Request completed');
});

