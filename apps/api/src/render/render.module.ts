import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ProjectsModule } from '../projects/projects.module';
import { BillingModule } from '../billing/billing.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RenderController } from './render.controller';
import { RenderService } from './render.service';

@Module({
  imports: [
    JwtModule.register({}),
    ProjectsModule,
    BillingModule,
    NotificationsModule,
  ],
  controllers: [RenderController],
  providers: [RenderService],
})
export class RenderModule {}
