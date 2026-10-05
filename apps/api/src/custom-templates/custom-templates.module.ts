import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { CustomTemplatesController } from './custom-templates.controller';
import { CustomTemplatesService } from './custom-templates.service';

@Module({
  imports: [ProjectsModule],
  controllers: [CustomTemplatesController],
  providers: [CustomTemplatesService],
  exports: [CustomTemplatesService],
})
export class CustomTemplatesModule {}
