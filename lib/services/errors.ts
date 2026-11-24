/** An expected failure (bad input, not found, out of stock) with the HTTP status to report. */
export class ServiceError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message);
    this.name = 'ServiceError';
  }
}

/** Turns Mongoose validation/cast errors into ServiceErrors; rethrows anything else. */
export function toServiceError(error: any): ServiceError {
  if (error instanceof ServiceError) return error;
  if (error?.name === 'ValidationError') {
    const messages = Object.values(error.errors || {})
      .map((err: any) => err.message)
      .join(', ');
    return new ServiceError(messages || 'Validation failed', 400);
  }
  if (error?.name === 'CastError') {
    return new ServiceError(`Invalid ${error.path || 'value'}`, 400);
  }
  throw error;
}
