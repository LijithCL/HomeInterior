import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePublicCommentDto } from './dto/create-public-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly notifications: NotificationsService,
  ) {}

  private async notifyOwnerOfComment(
    projectId: string,
    authorId: string | null,
    authorName: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project || project.ownerId === authorId) return;
    await this.notifications.create({
      userId: project.ownerId,
      type: 'COMMENT_POSTED',
      title: `${authorName} commented on "${project.name}"`,
      projectId,
      linkPath: `/editor/${projectId}`,
    });
  }

  // Any access level (VIEWER included) can read and add comments —
  // commenting isn't a design mutation, it's the collaboration layer on
  // top of one, so a reviewer-only teammate should still be able to
  // participate without edit rights.
  async listForProject(userId: string, projectId: string) {
    await this.projects.findOneForUser(userId, projectId);
    return this.prisma.comment.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, projectId: string, dto: CreateCommentDto) {
    await this.projects.findOneForUser(userId, projectId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const authorName = user?.name ?? user?.email ?? 'Someone';
    const comment = await this.prisma.comment.create({
      data: {
        projectId,
        floorId: dto.floorId,
        x: dto.x,
        y: dto.y,
        body: dto.body,
        authorId: userId,
        authorName,
      },
    });
    await this.notifyOwnerOfComment(projectId, userId, authorName);
    return comment;
  }

  // These two back the /share/:token client-review routes (ShareViewController)
  // — no userId at all, since the viewer never logged in. Token validity
  // (ShareLinksService.resolveToken) is the only access check; there's no
  // narrower permission to enforce for someone who isn't a user.
  async listForProjectPublic(projectId: string) {
    return this.prisma.comment.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createPublic(projectId: string, dto: CreatePublicCommentDto) {
    const comment = await this.prisma.comment.create({
      data: {
        projectId,
        floorId: dto.floorId,
        x: dto.x,
        y: dto.y,
        body: dto.body,
        authorId: null,
        authorName: dto.authorName,
      },
    });
    await this.notifyOwnerOfComment(projectId, null, dto.authorName);
    return comment;
  }

  async update(
    userId: string,
    projectId: string,
    id: string,
    dto: UpdateCommentDto,
  ) {
    await this.projects.findOneForUser(userId, projectId);
    const comment = await this.prisma.comment.findFirst({
      where: { id, projectId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    return this.prisma.comment.update({ where: { id }, data: dto });
  }

  // Anyone with edit access can clean up stray comments, but only the
  // original author can delete someone else's — same "you can always
  // manage your own words" norm as most comment threads.
  async remove(userId: string, projectId: string, id: string) {
    const { access } =
      (await this.projects.resolveAccess(userId, projectId)) ?? {};
    if (!access) throw new NotFoundException('Project not found');
    const comment = await this.prisma.comment.findFirst({
      where: { id, projectId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== userId && access === 'VIEWER') {
      throw new ForbiddenException('You can only delete your own comments');
    }
    await this.prisma.comment.delete({ where: { id } });
    return { success: true };
  }
}
