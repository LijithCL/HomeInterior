import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateCustomTemplateDto } from './dto/create-custom-template.dto';

@Injectable()
export class CustomTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  // Any access level can save a copy for themselves — it's a personal
  // snapshot, not a shared resource, so viewing a project is enough.
  async create(userId: string, dto: CreateCustomTemplateDto) {
    await this.projects.findOneForUser(userId, dto.projectId);
    const latest = await this.prisma.designVersion.findFirst({
      where: { projectId: dto.projectId },
      orderBy: { versionNum: 'desc' },
    });
    return this.prisma.customTemplate.create({
      data: {
        ownerId: userId,
        name: dto.name,
        description: dto.description,
        document: latest?.document ?? {},
      },
    });
  }

  async listForUser(userId: string) {
    const templates = await this.prisma.customTemplate.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
    });
    return templates.map((t) => {
      const document = t.document as unknown as { walls?: unknown; rooms?: unknown };
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        createdAt: t.createdAt,
        preview: { walls: document.walls ?? [], rooms: document.rooms ?? [] },
      };
    });
  }

  async remove(userId: string, id: string) {
    const template = await this.prisma.customTemplate.findFirst({ where: { id, ownerId: userId } });
    if (!template) throw new NotFoundException('Template not found');
    await this.prisma.customTemplate.delete({ where: { id } });
    return { success: true };
  }

  // Used by ProjectsService.create() when a templateId isn't one of the
  // built-in PROJECT_TEMPLATES — scoped to the caller's own templates only,
  // so a guessed/borrowed id from another user can't be used to clone their
  // design.
  async findOwnedDocument(userId: string, id: string) {
    const template = await this.prisma.customTemplate.findFirst({ where: { id, ownerId: userId } });
    return template?.document;
  }
}
