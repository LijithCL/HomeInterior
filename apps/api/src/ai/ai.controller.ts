import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { ProjectsService } from '../projects/projects.service';
import { AiService } from './ai.service';
import { CreateGenerateDto } from './dto/create-generate.dto';
import { CreateEditDto } from './dto/create-edit.dto';
import { CreateImageDto } from './dto/create-image.dto';
import type { DesignDocument } from './document-types';

// Tighter than the app-wide default — generate/edit/image are the routes
// that will eventually call a paid Claude API once ANTHROPIC_API_KEY is
// set (see ai-provider.factory.ts), so this caps runaway cost even before
// that's configured.
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Post('generate')
  async generate(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
    @Body() dto: CreateGenerateDto,
  ) {
    await this.projectsService.requireEditAccess(user.id, projectId);
    return this.aiService.generate(projectId, user.id, dto.prompt);
  }

  @Post('edit')
  async edit(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
    @Body() dto: CreateEditDto,
  ) {
    await this.projectsService.requireEditAccess(user.id, projectId);
    return this.aiService.proposeEdits(
      projectId,
      user.id,
      dto.prompt,
      dto.document as unknown as DesignDocument,
    );
  }

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async image(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
    @Body() dto: CreateImageDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.projectsService.requireEditAccess(user.id, projectId);
    if (!file) {
      throw new BadRequestException('No photo provided');
    }
    let document: DesignDocument;
    try {
      document = JSON.parse(dto.document) as DesignDocument;
    } catch {
      throw new BadRequestException(
        'document must be a JSON-encoded design document',
      );
    }
    return this.aiService.proposeFromImage(
      projectId,
      user.id,
      dto.prompt,
      document,
      file,
    );
  }

  @Get()
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
  ) {
    await this.projectsService.findOneForUser(user.id, projectId);
    return this.aiService.listForProject(projectId);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    await this.projectsService.findOneForUser(user.id, projectId);
    return this.aiService.findOne(projectId, id);
  }

  @Post(':id/apply')
  async apply(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    await this.projectsService.requireEditAccess(user.id, projectId);
    return this.aiService.apply(projectId, user.id, id);
  }

  @Post(':id/reject')
  async reject(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    await this.projectsService.requireEditAccess(user.id, projectId);
    return this.aiService.reject(projectId, id);
  }
}
