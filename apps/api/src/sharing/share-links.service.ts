import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ProjectsService } from '../projects/projects.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateShareLinkDto } from './dto/create-share-link.dto';

const EMPTY_DOCUMENT = {
  schemaVersion: 2,
  floors: [],
  walls: [],
  openings: [],
  rooms: [],
  objects: [],
};

export interface DesignDocumentLike {
  objects?: { assetId: string }[];
  openings?: { assetId: string }[];
}

@Injectable()
export class ShareLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly projects: ProjectsService,
    private readonly notifications: NotificationsService,
  ) {}

  // Sharing is an owner-level action (§8 exit criteria talks about "a
  // user" sharing their own work) — team EDITOR/VIEWER members can't mint
  // public links to a project they don't own.
  async create(userId: string, projectId: string, dto: CreateShareLinkDto) {
    await this.projects.requireOwnerAccess(userId, projectId);
    const token = randomBytes(24).toString('base64url');
    return this.prisma.shareLink.create({
      data: {
        projectId,
        token,
        createdBy: userId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
  }

  async listForProject(userId: string, projectId: string) {
    await this.projects.requireOwnerAccess(userId, projectId);
    return this.prisma.shareLink.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(userId: string, projectId: string, id: string) {
    await this.projects.requireOwnerAccess(userId, projectId);
    const link = await this.prisma.shareLink.findFirst({
      where: { id, projectId },
    });
    if (!link) throw new NotFoundException('Share link not found');
    return this.prisma.shareLink.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  // Every no-auth /share/:token route (the viewer itself, and the
  // anonymous comment endpoints below) starts by resolving the token to a
  // live project this same way — link exists, not revoked/expired, project
  // not soft-deleted.
  async resolveToken(token: string): Promise<{ id: string; name: string }> {
    const link = await this.prisma.shareLink.findUnique({ where: { token } });
    const expired = link?.expiresAt && link.expiresAt < new Date();
    if (!link || link.revokedAt || expired) {
      throw new NotFoundException('This share link is invalid or has expired');
    }

    const project = await this.prisma.project.findFirst({
      where: { id: link.projectId, deletedAt: null },
    });
    if (!project) {
      throw new NotFoundException('This share link is invalid or has expired');
    }
    return { id: project.id, name: project.name };
  }

  // The one endpoint on this service with no auth at all — resolves a
  // public view-only link to exactly what the viewer page needs: the
  // project's name, its latest document, and only the catalog assets that
  // document actually references (never the full catalog, which requires
  // login via AssetsController).
  async resolvePublic(token: string) {
    const project = await this.resolveToken(token);

    const link = await this.prisma.shareLink.findUnique({ where: { token } });
    if (link) {
      await this.notifications.create({
        userId: link.createdBy,
        type: 'SHARE_LINK_VIEWED',
        title: `Your share link for "${project.name}" was viewed`,
        projectId: project.id,
        linkPath: `/editor/${project.id}`,
      });
    }

    const latestVersion = await this.prisma.designVersion.findFirst({
      where: { projectId: project.id },
      orderBy: { versionNum: 'desc' },
    });
    const document = (latestVersion?.document ??
      EMPTY_DOCUMENT) as unknown as DesignDocumentLike;

    const assetIds = new Set<string>();
    for (const o of document.objects ?? []) assetIds.add(o.assetId);
    for (const o of document.openings ?? []) assetIds.add(o.assetId);
    const assets = await this.prisma.asset.findMany({
      where: { id: { in: [...assetIds] } },
    });

    return {
      project: { id: project.id, name: project.name },
      document,
      assets: assets.map((asset) => {
        const { thumbnailKey, ...rest } = asset;
        return {
          ...rest,
          thumbnailUrl: thumbnailKey
            ? this.storage.getSignedUrl(thumbnailKey)
            : null,
        };
      }),
    };
  }
}
