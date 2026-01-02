import { createMiddleware } from 'hono/factory';
import { nanoid } from 'nanoid';

export const requestIdMiddleware = createMiddleware(async (c, next) => {
  const requestId = c.req.header('x-request-id') || nanoid();
  c.set('requestId', requestId);
  c.header('x-request-id', requestId);
  await next();
});

// Extend Hono context type
declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
  }
}

