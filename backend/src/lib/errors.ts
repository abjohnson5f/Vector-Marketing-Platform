import { nanoid } from 'nanoid';

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    traceId: string;
  };
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly traceId: string;

  constructor(
    message: string,
    code: string = 'INTERNAL_ERROR',
    statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.traceId = nanoid();
  }

  toJSON(): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        traceId: this.traceId,
      },
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMITED', 429);
    this.name = 'RateLimitError';
  }
}

export class IntegrationError extends AppError {
  constructor(message: string, public readonly platform: string) {
    super(message, 'INTEGRATION_ERROR', 502);
    this.name = 'IntegrationError';
  }
}

