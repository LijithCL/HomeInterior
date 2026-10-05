import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { Prisma } from '../../generated/prisma/client';
import { CreateProposalDto } from './dto/create-proposal.dto';

@Injectable()
export class ProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly notifications: NotificationsService,
  ) {}

  // Sending a client a cost breakdown is an owner-level action, same norm
  // as ShareLinksService — a team EDITOR can work on the design but
  // shouldn't unilaterally send billing communication to the client.
  async create(userId: string, projectId: string, dto: CreateProposalDto) {
    await this.projects.requireOwnerAccess(userId, projectId);
    const lineItemsTotal = dto.lineItems.reduce(
      (sum, item) => sum + item.amountCents,
      0,
    );
    const designFeeCents = dto.designFeeCents ?? 0;
    return this.prisma.proposal.create({
      data: {
        projectId,
        createdBy: userId,
        title: dto.title,
        notes: dto.notes,
        designFeeCents,
        lineItems: dto.lineItems as unknown as Prisma.InputJsonValue,
        totalCents: lineItemsTotal + designFeeCents,
      },
    });
  }

  async listForProject(userId: string, projectId: string) {
    await this.projects.requireOwnerAccess(userId, projectId);
    return this.prisma.proposal.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, projectId: string, id: string) {
    await this.projects.requireOwnerAccess(userId, projectId);
    const proposal = await this.prisma.proposal.findFirst({
      where: { id, projectId },
    });
    if (!proposal) throw new NotFoundException('Proposal not found');
    return proposal;
  }

  // Generates the client-facing share token on first send; re-sending a
  // proposal (e.g. after editing) reuses the same token so an
  // already-shared link keeps working.
  async send(userId: string, projectId: string, id: string) {
    await this.projects.requireOwnerAccess(userId, projectId);
    const proposal = await this.prisma.proposal.findFirst({
      where: { id, projectId },
    });
    if (!proposal) throw new NotFoundException('Proposal not found');
    return this.prisma.proposal.update({
      where: { id },
      data: {
        status: 'SENT',
        shareToken:
          proposal.shareToken ?? randomBytes(24).toString('base64url'),
      },
    });
  }

  async remove(userId: string, projectId: string, id: string) {
    await this.projects.requireOwnerAccess(userId, projectId);
    const proposal = await this.prisma.proposal.findFirst({
      where: { id, projectId },
    });
    if (!proposal) throw new NotFoundException('Proposal not found');
    await this.prisma.proposal.delete({ where: { id } });
    return { success: true };
  }

  // The no-auth client view (ProposalViewController) — token validity is
  // the only access check, same model as ShareLinksService.resolveToken.
  async resolvePublic(token: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { shareToken: token },
    });
    if (!proposal || proposal.status === 'DRAFT') {
      throw new NotFoundException('This proposal link is invalid');
    }
    const project = await this.prisma.project.findFirst({
      where: { id: proposal.projectId, deletedAt: null },
    });
    if (!project) throw new NotFoundException('This proposal link is invalid');
    return { proposal, projectName: project.name };
  }

  async respondPublic(token: string, status: 'ACCEPTED' | 'DECLINED') {
    const proposal = await this.prisma.proposal.findUnique({
      where: { shareToken: token },
    });
    if (!proposal) throw new NotFoundException('This proposal link is invalid');
    if (proposal.status !== 'SENT') {
      throw new BadRequestException(
        'This proposal has already been responded to',
      );
    }
    const updated = await this.prisma.proposal.update({
      where: { id: proposal.id },
      data: { status, respondedAt: new Date() },
    });
    await this.notifications.create({
      userId: proposal.createdBy,
      type: 'PROPOSAL_RESPONDED',
      title: `Proposal "${proposal.title}" was ${status === 'ACCEPTED' ? 'accepted' : 'declined'}`,
      projectId: proposal.projectId,
      linkPath: `/editor/${proposal.projectId}`,
    });
    return updated;
  }
}
