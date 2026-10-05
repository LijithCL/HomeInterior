import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { ProjectsService } from '../projects/projects.service';
import { RenderService } from './render.service';
import { CreateRenderJobDto } from './dto/create-render-job.dto';

@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/render-jobs')
export class RenderController {
  constructor(
    private readonly renderService: RenderService,
    private readonly projectsService: ProjectsService,
  ) {}

  // Each render job spins up a full headless Chromium — tighter than the
  // app-wide default so a script can't accidentally queue dozens of these
  // at once.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
    @Body() dto: CreateRenderJobDto,
  ) {
    await this.projectsService.requireEditAccess(user.id, projectId);
    return this.renderService.create(projectId, user.id, dto.tier);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    await this.projectsService.findOneForUser(user.id, projectId);
    return this.renderService.findOne(projectId, id);
  }
}
