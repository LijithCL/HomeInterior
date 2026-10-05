import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, Project } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssetsService } from '../assets/assets.service';
import { StorageService } from '../storage/storage.service';
import { UploadsService } from '../uploads/uploads.service';
import { buildDocumentFromPlan } from '../ai/layout/layout-builder';
import type { AiCatalogAsset } from '../ai/providers/ai-provider.interface';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { findProjectTemplate, PROJECT_TEMPLATES } from './templates';
import { classifyRoomName, type RoomKind } from './room-kind';

export type ProjectAccessLevel = 'OWNER' | 'EDITOR' | 'VIEWER';

// Mirrors apps/web/src/lib/editor/document.ts createEmptyDocument(). Kept in
// sync by hand for now since the document schema isn't shared between
// apps/api and apps/web yet (see docs/ARCHITECTURE.md on packages/schema).
const EMPTY_DESIGN_DOCUMENT = {
  schemaVersion: 2,
  floors: [
    { id: 'floor-ground', name: 'Ground Floor', levelIndex: 0, heightMm: 3000 },
  ],
  walls: [],
  openings: [],
  rooms: [],
  objects: [],
};

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
    private readonly storage: StorageService,
    private readonly uploads: UploadsService,
  ) {}

  // Mirrors AiService.catalog() — kept as a separate copy since templates
  // and AI generation are independent features that both happen to reuse
  // buildDocumentFromPlan().
  private async catalog(): Promise<AiCatalogAsset[]> {
    const assets = await this.assets.findAll();
    return assets.map((a) => ({
      id: a.id,
      name: a.name,
      category: a.category,
      defaultWidthMm: a.defaultWidthMm,
      defaultDepthMm: a.defaultDepthMm,
      defaultHeightMm: a.defaultHeightMm,
      color: a.color,
    }));
  }

  // Runs every built-in template through the exact same
  // buildDocumentFromPlan() call `create()` below uses, so the thumbnail a
  // user sees in the gallery is provably what they'll actually get — never
  // a hand-drawn approximation that can drift from the real layout logic.
  async listTemplatesWithPreview() {
    const catalog = await this.catalog();
    return PROJECT_TEMPLATES.map((template) => {
      const document = buildDocumentFromPlan(template.plan, catalog);
      return {
        id: template.id,
        label: template.label,
        description: template.description,
        preview: { walls: document.walls, rooms: document.rooms },
      };
    });
  }

  // Checks the built-in PROJECT_TEMPLATES first, then falls back to the
  // caller's own CustomTemplate rows — queried directly here (not via a
  // CustomTemplatesService) to avoid a module import cycle, since
  // CustomTemplatesModule already depends on ProjectsModule for its own
  // access checks.
  private async resolveInitialDocument(
    ownerId: string,
    templateId: string | undefined,
  ) {
    const builtIn = findProjectTemplate(templateId);
    if (builtIn)
      return buildDocumentFromPlan(builtIn.plan, await this.catalog());

    if (templateId) {
      const custom = await this.prisma.customTemplate.findFirst({
        where: { id: templateId, ownerId },
      });
      if (custom) return custom.document as unknown as Record<string, unknown>;
    }
    return EMPTY_DESIGN_DOCUMENT;
  }

  async create(ownerId: string, dto: CreateProjectDto) {
    const document = await this.resolveInitialDocument(ownerId, dto.templateId);

    return this.prisma.project.create({
      data: {
        ownerId,
        name: dto.name,
        description: dto.description,
        versions: {
          create: {
            versionNum: 1,
            document: document as unknown as Prisma.InputJsonValue,
            createdBy: ownerId,
          },
        },
      },
    });
  }

  // A user's project list now spans two ownership shapes: projects they
  // personally created, and projects owned by any team they belong to
  // (§8 — team accounts).
  async findAllForUser(userId: string, roomKind?: RoomKind) {
    const projects = await this.prisma.project.findMany({
      where: {
        deletedAt: null,
        OR: [{ ownerId: userId }, { team: { members: { some: { userId } } } }],
      },
      orderBy: { updatedAt: 'desc' },
    });
    return roomKind ? this.filterByRoomKind(projects, roomKind) : projects;
  }

  // No stored room-type column — a project's room kinds are computed from
  // its latest document on every filtered request. Fine at this app's
  // scale; a materialized column would be the move if project counts ever
  // made per-request document parsing a real cost.
  private async filterByRoomKind<T extends { id: string }>(
    projects: T[],
    roomKind: RoomKind,
  ): Promise<T[]> {
    if (projects.length === 0) return projects;
    const versions = await this.prisma.designVersion.findMany({
      where: { projectId: { in: projects.map((p) => p.id) } },
      orderBy: { versionNum: 'desc' },
      select: { projectId: true, versionNum: true, document: true },
    });
    const latestByProject = new Map<string, unknown>();
    for (const v of versions) {
      if (!latestByProject.has(v.projectId))
        latestByProject.set(v.projectId, v.document);
    }
    return projects.filter((project) => {
      const document = latestByProject.get(project.id) as
        { rooms?: { name: string }[] } | undefined;
      return (document?.rooms ?? []).some(
        (room) => classifyRoomName(room.name) === roomKind,
      );
    });
  }

  // "Team Work" view — every project a given team owns, gated on the
  // caller actually being a member (any role) of that team.
  async findAllForTeam(userId: string, teamId: string, roomKind?: RoomKind) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of that team');
    }
    const projects = await this.prisma.project.findMany({
      where: { teamId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
    return roomKind ? this.filterByRoomKind(projects, roomKind) : projects;
  }

  // The single place project access is decided (§8 — permission roles).
  // Every other method, and RenderController/AiController's authorization
  // gates, go through this rather than checking ownerId directly. The
  // project's own personal owner is always OWNER; for a team-owned
  // project, access is exactly the caller's TeamMember role — TeamRole and
  // ProjectAccessLevel share the same three values on purpose, so a
  // team's OWNER-role member gets full OWNER-level control over every
  // project that team owns, not just edit access.
  async resolveAccess(
    userId: string,
    id: string,
  ): Promise<{ project: Project; access: ProjectAccessLevel } | null> {
    const project = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
    });
    if (!project) return null;
    if (project.ownerId === userId) return { project, access: 'OWNER' };
    if (project.teamId) {
      const membership = await this.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: project.teamId, userId } },
      });
      if (membership) return { project, access: membership.role };
    }
    return null;
  }

  async findOneForUser(userId: string, id: string): Promise<Project> {
    const resolved = await this.resolveAccess(userId, id);
    if (!resolved) throw new NotFoundException('Project not found');
    return resolved.project;
  }

  // Read access (VIEWER and above) isn't enough here — use this for any
  // route that mutates the design or its derived state (saves, renders,
  // AI proposals, deletes-via-update, etc.).
  async requireEditAccess(userId: string, id: string): Promise<Project> {
    const resolved = await this.resolveAccess(userId, id);
    if (!resolved) throw new NotFoundException('Project not found');
    if (resolved.access === 'VIEWER') {
      throw new ForbiddenException('You have view-only access to this project');
    }
    return resolved.project;
  }

  async requireOwnerAccess(userId: string, id: string): Promise<Project> {
    const resolved = await this.resolveAccess(userId, id);
    if (!resolved) throw new NotFoundException('Project not found');
    if (resolved.access !== 'OWNER') {
      throw new ForbiddenException('Only the project owner can do this');
    }
    return resolved.project;
  }

  async update(userId: string, id: string, dto: UpdateProjectDto) {
    await this.requireEditAccess(userId, id);
    return this.prisma.project.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.requireOwnerAccess(userId, id);
    await this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  // Moves a project into a team, or back out (teamId: null) to purely
  // personal. Owner-only, and only into a team the owner actually belongs
  // to — otherwise anyone could grant their own team access to a project
  // they don't control by guessing a teamId.
  async setTeam(userId: string, id: string, teamId: string | null) {
    await this.requireOwnerAccess(userId, id);
    if (teamId) {
      const membership = await this.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId } },
      });
      if (!membership)
        throw new ForbiddenException('You are not a member of that team');
    }
    return this.prisma.project.update({ where: { id }, data: { teamId } });
  }

  async getLatestVersion(userId: string, id: string) {
    await this.findOneForUser(userId, id);
    return this.prisma.designVersion.findFirst({
      where: { projectId: id },
      orderBy: { versionNum: 'desc' },
    });
  }

  async saveVersion(
    userId: string,
    id: string,
    document: Record<string, unknown>,
  ) {
    await this.requireEditAccess(userId, id);

    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.designVersion.findFirst({
        where: { projectId: id },
        orderBy: { versionNum: 'desc' },
      });
      const version = await tx.designVersion.create({
        data: {
          projectId: id,
          versionNum: (latest?.versionNum ?? 0) + 1,
          document: document as Prisma.InputJsonValue,
          createdBy: userId,
        },
      });
      await tx.project.update({
        where: { id },
        data: { updatedAt: new Date() },
      });
      return version;
    });
  }

  // Lightweight list for the version-history panel — omits `document`
  // (can be a large JSON blob) since the panel only needs enough to label
  // each entry and let the user pick one to restore or preview.
  async listVersions(userId: string, id: string) {
    await this.findOneForUser(userId, id);
    return this.prisma.designVersion.findMany({
      where: { projectId: id },
      orderBy: { versionNum: 'desc' },
      select: { id: true, versionNum: true, createdBy: true, createdAt: true },
    });
  }

  // Restoring never deletes or rewrites history — it just replays the old
  // version's document into a brand new version on top, the same way a
  // manual Save would. That keeps "restore" as unsurprising/reversible as
  // any other edit (undo-by-restoring-again still works).
  async restoreVersion(userId: string, id: string, versionNum: number) {
    const target = await this.prisma.designVersion.findUnique({
      where: { projectId_versionNum: { projectId: id, versionNum } },
    });
    if (!target) throw new NotFoundException('Version not found');
    return this.saveVersion(
      userId,
      id,
      target.document as Record<string, unknown>,
    );
  }

  // Backs the 2D editor's "trace over a blueprint" underlay (§ CAD import,
  // scoped down to an image trace rather than a real DXF/vector parser).
  // The image itself lives in Floor.underlayImageKey inside the JSON
  // document, not a DB column — only the upload/signing needs a real
  // endpoint, same reasoning as Asset.thumbnailKey.
  async uploadUnderlayImage(
    userId: string,
    id: string,
    file: { mimetype: string; size: number; buffer: Buffer } | undefined,
  ) {
    await this.requireEditAccess(userId, id);
    if (!file) throw new BadRequestException('No file provided');
    const key = await this.uploads.saveImage(file, 'floor-underlay');
    return { key, url: this.storage.getSignedUrl(key) };
  }

  // The signed URL embedded in the document at upload time expires (see
  // StorageService's 1hr default TTL) long before most designs are done —
  // the editor calls this again on load to get a fresh one for the same key.
  async getUnderlayImageUrl(userId: string, id: string, key: string) {
    await this.findOneForUser(userId, id);
    return { url: this.storage.getSignedUrl(key) };
  }
}
