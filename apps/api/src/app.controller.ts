import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  // A static { status: 'ok' } would pass even while Postgres is down —
  // the actual failure mode most likely to page someone. This pings the
  // DB on every check instead; a load balancer or uptime monitor can then
  // tell "app process is up" apart from "app is actually usable".
  @Get('health')
  @HttpCode(HttpStatus.OK)
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'unreachable',
      });
    }
    return { status: 'ok', database: 'ok' };
  }
}
