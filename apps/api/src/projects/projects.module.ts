import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { UploadsModule } from '../uploads/uploads.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [AssetsModule, UploadsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
