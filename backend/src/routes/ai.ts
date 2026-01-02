import { Hono } from 'hono';
import { z } from 'zod';
import { getAdvancedInsights, chatWithMarketingAI } from '../services/gemini.js';
import { ValidationError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

const ai = new Hono();

// Request schemas
const insightsSchema = z.object({
  domain: z.string().min(1).max(100),
  metrics: z.array(z.object({
    label: z.string(),
    value: z.string(),
    change: z.number(),
  })).optional().default([]),
  campaigns: z.array(z.object({
    name: z.string(),
    spend: z.number(),
    revenue: z.number(),
    roas: z.number(),
  })).optional().default([]),
});

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  domain: z.string().min(1).max(100),
  metrics: z.array(z.object({
    label: z.string(),
    value: z.string(),
    change: z.number(),
  })).optional().default([]),
});

/**
 * POST /api/v1/ai/insights
 * Generates AI-powered marketing insights
 */
ai.post('/insights', async (c) => {
  const body = await c.req.json();
  const data = insightsSchema.parse(body);
  
  const clientId = c.req.header('x-client-id') || c.get('requestId');
  
  logger.info({ domain: data.domain }, 'Generating AI insights');
  
  const insights = await getAdvancedInsights(
    data.domain,
    { metrics: data.metrics, campaigns: data.campaigns },
    clientId
  );
  
  return c.json({ insights });
});

/**
 * POST /api/v1/ai/chat
 * Handles conversational AI queries with search grounding
 */
ai.post('/chat', async (c) => {
  const body = await c.req.json();
  const data = chatSchema.parse(body);
  
  const clientId = c.req.header('x-client-id') || c.get('requestId');
  
  logger.info({ messageLength: data.message.length }, 'Processing AI chat');
  
  const response = await chatWithMarketingAI(
    data.message,
    { domain: data.domain, metrics: data.metrics },
    clientId
  );
  
  return c.json(response);
});

export default ai;

