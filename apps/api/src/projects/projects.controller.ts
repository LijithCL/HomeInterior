import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { SaveVersionDto } from './dto/save-version.dto';
import { SetTeamDto } from './dto/set-team.dto';
import { ROOM_KINDS, type RoomKind } from './room-kind';

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(user.id, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('teamId') teamId?: string,
    @Query('roomKind') roomKind?: string,
  ) {
    const kind = ROOM_KINDS.includes(roomKind as RoomKind)
      ? (roomKind as RoomKind)
      : undefined;
    if (teamId)
      return this.projectsService.findAllForTeam(user.id, teamId, kind);
    return this.projectsService.findAllForUser(user.id, kind);
  }

  // Must be registered before @Get(':id') — otherwise Nest's routing would
  // treat "templates" as an :id and send this to findOne() instead.
  @Get('templates')
  listTemplates() {
    return this.projectsService.listTemplatesWithPreview();
  }

  @Get(':id')
  findOne(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.projectsService.findOneForUser(user.id, id);
  }

  @Get(':id/latest-version')
  getLatestVersion(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.projectsService.getLatestVersion(user.id, id);
  }

  @Post(':id/versions')
  saveVersion(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: SaveVersionDto,
  ) {
    return this.projectsService.saveVersion(user.id, id, dto.document);
  }

  @Get(':id/versions')
  listVersions(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.projectsService.listVersions(user.id, id);
  }

  @Post(':id/versions/:versionNum/restore')
  restoreVersion(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Param('versionNum') versionNum: string,
  ) {
    return this.projectsService.restoreVersion(user.id, id, Number(versionNum));
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.projectsService.remove(user.id, id);
  }

  @Post(':id/underlay-image')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  uploadUnderlayImage(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.projectsService.uploadUnderlayImage(user.id, id, file);
  }

  @Get(':id/underlay-image-url')
  getUnderlayImageUrl(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Query('key') key: string,
  ) {
    return this.projectsService.getUnderlayImageUrl(user.id, id, key);
  }

  @Patch(':id/team')
  setTeam(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: SetTeamDto,
  ) {
    return this.projectsService.setTeam(user.id, id, dto.teamId ?? null);
  }
}
