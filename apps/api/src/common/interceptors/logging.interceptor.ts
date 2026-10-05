import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

// One line per request: method, path, status, duration, and a request id
// that ties this line to whatever AllExceptionsFilter logs for the same
// request if it errors. This is the only request-level observability the
// app has — no APM, no log aggregator, just readable stdout lines, which
// matches every other "no paid infra" choice in this project. The id
// itself is assigned by requestIdMiddleware (plain Express middleware,
// registered before Nest's guards) — not here, since a guard rejection
// never reaches this interceptor.
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { id?: string }>();
    const response = context.switchToHttp().getResponse<Response>();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.log(request, response.statusCode, start),
        error: () => this.log(request, response.statusCode || 500, start),
      }),
    );
  }

  private log(
    request: Request & { id?: string },
    status: number,
    start: number,
  ): void {
    const durationMs = Date.now() - start;
    this.logger.log(
      `${request.method} ${request.originalUrl ?? request.url} ${status} ${durationMs}ms [${request.id}]`,
    );
  }
}
