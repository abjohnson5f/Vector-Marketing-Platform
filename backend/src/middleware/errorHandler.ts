import { ErrorHandler } from 'hono';
import { AppError, ErrorResponse } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { nanoid } from 'nanoid';

export const errorHandler: ErrorHandler = (err, c) => {
  const requestId = c.get('requestId') || nanoid();
  
  // Handle AppError instances
  if (err instanceof AppError) {
    logger.warn({
      requestId,
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
    }, 'Application error');
    
    return c.json(err.toJSON(), err.statusCode as any);
  }
  
  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    const response: ErrorResponse = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        traceId: requestId,
      },
    };
    
    logger.warn({
      requestId,
      errors: (err as any).errors,
    }, 'Validation error');
    
    return c.json(response, 400);
  }
  
  // Handle unknown errors
  logger.error({
    requestId,
    error: err.message,
    stack: err.stack,
  }, 'Unhandled error');
  
  const response: ErrorResponse = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      traceId: requestId,
    },
  };
  
  return c.json(response, 500);
};

