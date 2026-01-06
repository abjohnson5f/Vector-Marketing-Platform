/**
 * Server-side Tracking Endpoint
 * 
 * This endpoint forwards tracking events to server-side GTM (sGTM).
 * Benefits of sGTM:
 * - Bypasses ad blockers
 * - First-party cookie context
 * - Better data accuracy
 * - Enhanced privacy control
 * 
 * Usage:
 * POST /api/v1/tracking/event
 * Body: { event_name: string, event_params: object }
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

const trackingRoutes = new Hono();

// Event payload schema
const trackingEventSchema = z.object({
  event_name: z.string().min(1).max(100),
  client_id: z.string().optional(),
  user_id: z.string().optional(),
  event_params: z.record(z.unknown()).optional(),
  user_properties: z.record(z.unknown()).optional(),
  timestamp_micros: z.number().optional(),
});

// Batch events schema
const batchEventsSchema = z.object({
  events: z.array(trackingEventSchema).min(1).max(25),
});

interface GA4Event {
  name: string;
  params?: Record<string, unknown>;
}

interface GA4Payload {
  client_id: string;
  user_id?: string;
  timestamp_micros?: number;
  user_properties?: Record<string, { value: unknown }>;
  events: GA4Event[];
}

/**
 * POST /api/v1/tracking/event
 * Forward a single event to GA4 Measurement Protocol
 */
trackingRoutes.post('/event', async (c) => {
  try {
    const body = trackingEventSchema.parse(await c.req.json());
    
    // Get client ID from cookie or generate one
    const clientId = body.client_id || 
      c.req.header('x-client-id') || 
      crypto.randomUUID();

    // Build GA4 payload
    const payload: GA4Payload = {
      client_id: clientId,
      events: [{
        name: body.event_name,
        params: body.event_params,
      }],
    };

    if (body.user_id) {
      payload.user_id = body.user_id;
    }

    if (body.timestamp_micros) {
      payload.timestamp_micros = body.timestamp_micros;
    }

    if (body.user_properties) {
      payload.user_properties = Object.fromEntries(
        Object.entries(body.user_properties).map(([key, value]) => [key, { value }])
      );
    }

    // Send to GA4 Measurement Protocol
    if (env.GA4_MEASUREMENT_ID && env.GA4_API_SECRET) {
      const ga4Url = `https://www.google-analytics.com/mp/collect?measurement_id=${env.GA4_MEASUREMENT_ID}&api_secret=${env.GA4_API_SECRET}`;
      
      const response = await fetch(ga4Url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        logger.warn({ status: response.status }, 'GA4 MP request failed');
      }
    }

    // Optionally forward to sGTM endpoint
    if (env.SGTM_ENDPOINT) {
      try {
        await fetch(env.SGTM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            ip_override: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
            user_agent: c.req.header('user-agent'),
          }),
        });
      } catch (sgtmError) {
        logger.warn({ error: sgtmError }, 'sGTM forward failed');
      }
    }

    logger.debug({ event: body.event_name, clientId }, 'Tracking event processed');

    return c.json({ success: true, client_id: clientId });
  } catch (error) {
    logger.error({ error }, 'Tracking event error');
    return c.json({ success: false, error: 'Invalid event payload' }, 400);
  }
});

/**
 * POST /api/v1/tracking/batch
 * Forward multiple events at once
 */
trackingRoutes.post('/batch', async (c) => {
  try {
    const { events } = batchEventsSchema.parse(await c.req.json());
    
    const clientId = events[0]?.client_id || 
      c.req.header('x-client-id') || 
      crypto.randomUUID();

    const ga4Events: GA4Event[] = events.map(e => ({
      name: e.event_name,
      params: e.event_params,
    }));

    const payload: GA4Payload = {
      client_id: clientId,
      events: ga4Events,
    };

    if (env.GA4_MEASUREMENT_ID && env.GA4_API_SECRET) {
      const ga4Url = `https://www.google-analytics.com/mp/collect?measurement_id=${env.GA4_MEASUREMENT_ID}&api_secret=${env.GA4_API_SECRET}`;
      
      await fetch(ga4Url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    logger.debug({ eventCount: events.length, clientId }, 'Batch tracking events processed');

    return c.json({ success: true, client_id: clientId, events_processed: events.length });
  } catch (error) {
    logger.error({ error }, 'Batch tracking error');
    return c.json({ success: false, error: 'Invalid batch payload' }, 400);
  }
});

/**
 * POST /api/v1/tracking/conversion
 * Forward enhanced conversion data (for Google Ads)
 */
trackingRoutes.post('/conversion', async (c) => {
  const conversionSchema = z.object({
    conversion_action: z.string(),
    gclid: z.string().optional(),
    gbraid: z.string().optional(),
    wbraid: z.string().optional(),
    conversion_time: z.string().optional(),
    conversion_value: z.number().optional(),
    currency_code: z.string().default('USD'),
    order_id: z.string().optional(),
    // Enhanced conversions data (hashed)
    email_sha256: z.string().optional(),
    phone_sha256: z.string().optional(),
    first_name_sha256: z.string().optional(),
    last_name_sha256: z.string().optional(),
  });

  try {
    const body = conversionSchema.parse(await c.req.json());
    
    // In production, this would send to Google Ads Conversion API
    // For now, we just log and forward to sGTM
    logger.info({ conversion: body.conversion_action, gclid: body.gclid }, 'Conversion received');

    if (env.SGTM_ENDPOINT) {
      await fetch(`${env.SGTM_ENDPOINT}/conversion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          timestamp: new Date().toISOString(),
        }),
      });
    }

    return c.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Conversion tracking error');
    return c.json({ success: false, error: 'Invalid conversion payload' }, 400);
  }
});

export default trackingRoutes;




