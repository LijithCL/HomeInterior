import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

// The one place every error response gets its final shape. Before this,
// a thrown HttpException already produced a reasonable JSON body on its
// own, but anything else (a Prisma error, a bug, a third-party SDK
// throwing) bubbled up as whatever Express's default handler happened to
// produce — inconsistent shape, and worse, it could leak the raw error
// message (stack traces, DB error text) straight to the client. Every
// non-HttpException here becomes a generic 500 with no internal detail;
// the real message and stack still go to the server log.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();
    const path = request.originalUrl ?? request.url;

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    let error = 'InternalServerError';
    let message: string | string[] = 'Internal server error';

    if (isHttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        error = exception.name;
      } else if (body && typeof body === 'object') {
        const b = body as { error?: string; message?: string | string[] };
        message = b.message ?? exception.message;
        error = b.error ?? exception.name;
      }
    }

    // This is the only place a guard rejection (401/403), a rate-limit
    // rejection (429), or an unmatched route (404) ever gets logged — none
    // of those reach LoggingInterceptor, since guards run before
    // interceptors and an unmatched route never enters Nest's handler
    // pipeline at all. 5xx is a real bug (full detail + stack); 4xx is an
    // expected client error, logged at a lower level so it doesn't read
    // as an incident.
    const line = `${request.method} ${path} -> ${status} [${request.id}]`;
    if (status >= 500) {
      const detail =
        exception instanceof Error ? exception.message : String(exception);
      this.logger.error(
        `${line}${isHttpException ? '' : ` (${detail})`}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(line);
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      path,
      timestamp: new Date().toISOString(),
      requestId: request.id,
    });
  }
}
