import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ShareLinksService } from './share-links.service';
import { CommentsService } from '../comments/comments.service';
import { CreatePublicCommentDto } from '../comments/dto/create-public-comment.dto';

// Deliberately outside JwtAuthGuard — a share link's whole point is that
// the recipient doesn't need an account (see ShareLinksService.resolvePublic
// for what's actually exposed: no full asset catalog, no other projects).
// The comment routes below extend that same no-auth model to client review
// (§ collaboration): a viewer can read and add pinned comments, but never
// resolve/delete one — those stay behind the authenticated CommentsController.
@Controller('share')
export class ShareViewController {
  constructor(
    private readonly shareLinksService: ShareLinksService,
    private readonly comments: CommentsService,
  ) {}

  @Get(':token')
  resolve(@Param('token') token: string) {
    return this.shareLinksService.resolvePublic(token);
  }

  @Get(':token/comments')
  async listComments(@Param('token') token: string) {
    const project = await this.shareLinksService.resolveToken(token);
    return this.comments.listForProjectPublic(project.id);
  }

  @Post(':token/comments')
  async createComment(
    @Param('token') token: string,
    @Body() dto: CreatePublicCommentDto,
  ) {
    const project = await this.shareLinksService.resolveToken(token);
    return this.comments.createPublic(project.id, dto);
  }
}
