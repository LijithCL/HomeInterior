import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  // rawBody: true keeps req.rawBody available alongside the normal parsed
  // body — needed by the Stripe webhook route, which must verify the
  // signature against the exact raw bytes Stripe sent, not the
  // re-serialized JSON (see BillingService.handleWebhookEvent).
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.use(requestIdMiddleware);
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.WEB_ORIGIN,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
