import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { UploadsModule } from '../uploads/uploads.module';
import { AssetsModule } from '../assets/assets.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { aiProviderFactory } from './providers/ai-provider.factory';

@Module({
  imports: [ProjectsModule, UploadsModule, AssetsModule],
  controllers: [AiController],
  providers: [AiService, aiProviderFactory],
})
export class AiModule {}
