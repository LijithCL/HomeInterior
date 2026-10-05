import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { AssetsModule } from './assets/assets.module';
import { StorageModule } from './storage/storage.module';
import { UploadsModule } from './uploads/uploads.module';
import { RenderModule } from './render/render.module';
import { AiModule } from './ai/ai.module';
import { TeamsModule } from './teams/teams.module';
import { SharingModule } from './sharing/sharing.module';
import { BillingModule } from './billing/billing.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CommentsModule } from './comments/comments.module';
import { CustomTemplatesModule } from './custom-templates/custom-templates.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ProposalsModule } from './proposals/proposals.module';
import { envValidationSchema } from './env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    // Generous global default (every route gets this unless overridden by
    // a @Throttle() decorator) — the point isn't to rate-limit normal
    // usage, it's a backstop against runaway scripts. Auth and AI/render
    // creation get much tighter per-route limits (see those controllers)
    // since those are the abuse/cost-sensitive ones.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    PrismaModule,
    StorageModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    AssetsModule,
    UploadsModule,
    RenderModule,
    AiModule,
    TeamsModule,
    SharingModule,
    BillingModule,
    AnalyticsModule,
    CommentsModule,
    CustomTemplatesModule,
    NotificationsModule,
    ProposalsModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
