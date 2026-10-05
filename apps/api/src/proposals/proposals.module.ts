import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProposalsController } from './proposals.controller';
import { ProposalViewController } from './proposal-view.controller';
import { ProposalsService } from './proposals.service';

@Module({
  imports: [ProjectsModule, NotificationsModule],
  controllers: [ProposalsController, ProposalViewController],
  providers: [ProposalsService],
})
export class ProposalsModule {}
