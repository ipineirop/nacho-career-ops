export class ApiError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
  }

  toResponse() {
    return new Response(
      JSON.stringify({
        error: this.message,
        code: this.code,
        ...(this.details && { details: this.details }),
      }),
      {
        status: this.statusCode,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: Record<string, any>) {
    super('VALIDATION_ERROR', 400, message, details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized') {
    super('UNAUTHORIZED', 401, message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = 'Forbidden') {
    super('FORBIDDEN', 403, message);
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super('NOT_FOUND', 404, `${resource} not found`);
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super('CONFLICT', 409, message);
  }
}

export class RateLimitError extends ApiError {
  constructor(retryAfterSeconds: number = 60) {
    super('RATE_LIMIT_EXCEEDED', 429, 'Rate limit exceeded. Please try again later.');
  }
}

export class InternalServerError extends ApiError {
  constructor(message: string = 'Internal server error') {
    super('INTERNAL_SERVER_ERROR', 500, message);
  }
}

// Helper to catch and convert errors
export function handleApiError(error: unknown): Response {
  if (error instanceof ApiError) {
    return error.toResponse();
  }

  if (error instanceof Error) {
    console.error('Unhandled error:', error);
    return new InternalServerError(error.message).toResponse();
  }

  console.error('Unknown error:', error);
  return new InternalServerError().toResponse();
}
