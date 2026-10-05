import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const REFRESH_COOKIE = 'refresh_token';

export const RefreshToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const cookies = request.cookies as Record<string, string> | undefined;
    return cookies?.[REFRESH_COOKIE];
  },
);
