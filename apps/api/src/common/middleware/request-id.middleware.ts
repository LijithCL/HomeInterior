import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

// Plain Express middleware, not a Nest guard/interceptor — it has to run
// before Nest's own pipeline (guards, then interceptors) so a request
// rejected by e.g. JwtAuthGuard still gets an id AllExceptionsFilter can
// log and return, not just requests that make it as far as a route handler.
export function requestIdMiddleware(
  request: Request & { id?: string },
  _response: Response,
  next: NextFunction,
): void {
  request.id = randomUUID();
  next();
}
