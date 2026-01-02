import { GoogleGenAI, Type } from '@google/genai';
import { env } from '../config/env.js';
import { ValidationError, RateLimitError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

// Rate limiting state (in production, use Redis)
const rateLimitState = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // per window

interface InsightContext {
  metrics: Array<{ label: string; value: string; change: number }>;
  campaigns: Array<{ name: string; spend: number; revenue: number; roas: number }>;
}

interface ChatContext {
  domain: string;
  metrics: Array<{ label: string; value: string; change: number }>;
}

interface AIInsight {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'optimization' | 'budget' | 'anomaly' | 'geo' | 'seo' | 'competitive';
  sources?: string[];
}

interface ChatResponse {
  text: string;
  sources: Array<{ uri: string; title: string }>;
}

/**
 * Simple rate limiter (use Redis in production)
 */
function checkRateLimit(clientId: string): void {
  const now = Date.now();
  const state = rateLimitState.get(clientId);
  
  if (!state || now > state.resetAt) {
    rateLimitState.set(clientId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }
  
  if (state.count >= RATE_LIMIT_MAX_REQUESTS) {
    throw new RateLimitError('AI request limit exceeded. Please try again in a minute.');
  }
  
  state.count++;
}

/**
 * Validates and sanitizes prompt input
 */
function validatePrompt(prompt: string, maxLength: number = 2000): string {
  if (!prompt || typeof prompt !== 'string') {
    throw new ValidationError('Prompt is required');
  }
  
  const sanitized = prompt.trim();
  
  if (sanitized.length === 0) {
    throw new ValidationError('Prompt cannot be empty');
  }
  
  if (sanitized.length > maxLength) {
    throw new ValidationError(`Prompt exceeds maximum length of ${maxLength} characters`);
  }
  
  // Basic PII stripping (email, phone patterns)
  const stripped = sanitized
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
  
  return stripped;
}

/**
 * Generates structured marketing insights
 */
export async function getAdvancedInsights(
  domain: string,
  context: InsightContext,
  clientId: string = 'default'
): Promise<AIInsight[]> {
  checkRateLimit(clientId);
  
  if (!env.GEMINI_API_KEY) {
    logger.warn('GEMINI_API_KEY not configured, returning empty insights');
    return [];
  }
  
  const validatedDomain = validatePrompt(domain, 100);
  
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const model = 'gemini-2.0-flash';
  
  const prompt = `
    Perform a deep omnichannel marketing analysis for the domain "${validatedDomain}".
    Current internal metrics: ${JSON.stringify(context.metrics)}
    Current active campaigns: ${JSON.stringify(context.campaigns)}

    Provide exactly 4 highly sophisticated insights in JSON format:
    1. A SEO recommendation specifically for "${validatedDomain}" based on keyword metrics.
    2. A competitive landscape analysis identifying a key threat or opportunity.
    3. A GEO-specific budget optimization recommendation.
    4. A Core Web Vitals performance recommendation to improve conversion rate.
  `;
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              priority: { type: Type.STRING, description: 'Priority: high, medium, or low' },
              category: { type: Type.STRING, description: 'Category: optimization, budget, anomaly, geo, seo, or competitive' },
              sources: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['title', 'description', 'priority', 'category'],
          },
        },
      },
    });
    
    const text = response.text?.trim();
    if (!text) return [];
    
    const insights = JSON.parse(text) as AIInsight[];
    
    logger.info({ domain: validatedDomain, insightCount: insights.length }, 'Generated AI insights');
    
    return insights;
  } catch (error) {
    logger.error({ error, domain: validatedDomain }, 'Gemini insight generation failed');
    return [];
  }
}

/**
 * Handles conversational strategy queries with Google Search grounding
 */
export async function chatWithMarketingAI(
  message: string,
  context: ChatContext,
  clientId: string = 'default'
): Promise<ChatResponse> {
  checkRateLimit(clientId);
  
  if (!env.GEMINI_API_KEY) {
    throw new ValidationError('AI service is not configured');
  }
  
  const validatedMessage = validatePrompt(message, 2000);
  const validatedDomain = validatePrompt(context.domain, 100);
  
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `You are a world-class marketing strategist. 
        Context: Domain: ${validatedDomain}, Metrics: ${JSON.stringify(context.metrics)}
        User question: ${validatedMessage}
        
        Provide a detailed, data-driven answer grounded in current marketing trends.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    
    // Extract grounding sources
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => chunk.web)
      .filter(Boolean)
      .map((web: any) => ({
        uri: web.uri,
        title: web.title,
      })) || [];
    
    logger.info({ 
      messageLength: validatedMessage.length, 
      sourceCount: sources.length,
    }, 'AI chat response generated');
    
    return {
      text: response.text || "I'm sorry, I couldn't process that strategy request.",
      sources,
    };
  } catch (error) {
    logger.error({ error }, 'Gemini chat failed');
    throw new ValidationError('AI service temporarily unavailable. Please try again.');
  }
}

