import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { ShareLinksService } from './share-links.service';
import { CreateShareLinkDto } from './dto/create-share-link.dto';

type ShareLinkRow = {
  id: string;
  token: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/share-links')
export class ShareLinksController {
  constructor(private readonly shareLinksService: ShareLinksService) {}

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
    @Body() dto: CreateShareLinkDto,
  ) {
    const link = await this.shareLinksService.create(user.id, projectId, dto);
    return this.toPublic(link);
  }

  @Get()
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
  ) {
    const links = await this.shareLinksService.listForProject(
      user.id,
      projectId,
    );
    return links.map((link) => this.toPublic(link));
  }

  @Post(':id/revoke')
  async revoke(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    const link = await this.shareLinksService.revoke(user.id, projectId, id);
    return this.toPublic(link);
  }

  private toPublic(link: ShareLinkRow) {
    const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
    return { ...link, url: `${webOrigin}/share/${link.token}` };
  }
}
