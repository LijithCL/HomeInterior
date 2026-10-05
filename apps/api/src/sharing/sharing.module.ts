import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { CommentsModule } from '../comments/comments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ShareLinksController } from './share-links.controller';
import { ShareViewController } from './share-view.controller';
import { ShareLinksService } from './share-links.service';

@Module({
  imports: [ProjectsModule, CommentsModule, NotificationsModule],
  controllers: [ShareLinksController, ShareViewController],
  providers: [ShareLinksService],
})
export class SharingModule {}
