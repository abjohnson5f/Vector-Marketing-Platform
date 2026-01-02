import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { requestLoggerMiddleware } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';

// Routes
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import integrationsRoutes from './routes/integrations.js';
import aiRoutes from './routes/ai.js';

const app = new Hono();

// Global middleware
app.use('*', cors({
  origin: env.NODE_ENV === 'production' 
    ? ['https://marketing.stiltnerlandscapes.com', 'https://stiltnerlandscapes.com'] 
    : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use('*', requestIdMiddleware);
app.use('*', requestLoggerMiddleware);

// Error handler
app.onError(errorHandler);

// Health check
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: env.NODE_ENV,
  });
});

// API routes
app.route('/api/auth', authRoutes);
app.route('/api/v1', dashboardRoutes);
app.route('/api/v1/integrations', integrationsRoutes);
app.route('/api/v1/ai', aiRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested endpoint does not exist',
      traceId: c.get('requestId'),
    },
  }, 404);
});

// Start server
const port = env.PORT;

logger.info({ port, env: env.NODE_ENV }, '🚀 Starting Vector Marketing API');

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  logger.info({ port: info.port }, `✅ Server running at http://localhost:${info.port}`);
});

export default app;

