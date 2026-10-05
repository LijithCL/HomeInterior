import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UploadsService } from '../uploads/uploads.service';
import { AssetsService } from '../assets/assets.service';
import { ProjectsService } from '../projects/projects.service';
import {
  AI_PROVIDER,
  type AiCatalogAsset,
  type AiProvider,
} from './providers/ai-provider.interface';
import { buildDocumentFromPlan } from './layout/layout-builder';
import { applyEditOps } from './layout/edit-ops';
import type { DesignDocument } from './document-types';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly uploads: UploadsService,
    private readonly assets: AssetsService,
    private readonly projects: ProjectsService,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
  ) {}

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

  async generate(projectId: string, userId: string, prompt: string) {
    const request = await this.prisma.aiRequest.create({
      data: {
        projectId,
        requestedBy: userId,
        type: 'FULL_GENERATION',
        prompt,
        baseDocument: {},
      },
    });

    try {
      const plan = await this.provider.proposeLayout({
        prompt,
        catalog: await this.catalog(),
      });
      const proposedDocument = buildDocumentFromPlan(
        plan,
        await this.catalog(),
      );
      return this.markProposed(request.id, proposedDocument, plan.notes);
    } catch (err) {
      return this.markFailed(request.id, err);
    }
  }

  async proposeEdits(
    projectId: string,
    userId: string,
    prompt: string,
    document: DesignDocument,
  ) {
    const request = await this.prisma.aiRequest.create({
      data: {
        projectId,
        requestedBy: userId,
        type: 'SCOPED_EDIT',
        prompt,
        baseDocument: document as unknown as Prisma.InputJsonValue,
      },
    });

    try {
      const catalog = await this.catalog();
      const plan = await this.provider.proposeEdits({
        prompt,
        document,
        catalog,
      });
      const { document: proposedDocument, changeSummary } = applyEditOps(
        document,
        plan.ops,
        catalog,
      );
      return this.markProposed(
        request.id,
        proposedDocument,
        changeSummary.join(' '),
      );
    } catch (err) {
      return this.markFailed(request.id, err);
    }
  }

  async proposeFromImage(
    projectId: string,
    userId: string,
    prompt: string | undefined,
    document: DesignDocument,
    file: { mimetype: string; size: number; buffer: Buffer },
  ) {
    const request = await this.prisma.aiRequest.create({
      data: {
        projectId,
        requestedBy: userId,
        type: 'IMAGE_TO_DESIGN',
        prompt,
        baseDocument: document as unknown as Prisma.InputJsonValue,
      },
    });

    try {
      const imageKey = await this.uploads.saveImage(file, 'ai-photo');
      await this.prisma.aiRequest.update({
        where: { id: request.id },
        data: { inputImageKey: imageKey },
      });

      const catalog = await this.catalog();
      const plan = await this.provider.proposeFromImage({
        prompt: prompt ?? '',
        document,
        catalog,
        imageBase64: file.buffer.toString('base64'),
        mimeType: file.mimetype,
      });
      const { document: proposedDocument, changeSummary } = applyEditOps(
        document,
        plan.ops,
        catalog,
      );
      return this.markProposed(
        request.id,
        proposedDocument,
        changeSummary.join(' '),
      );
    } catch (err) {
      return this.markFailed(request.id, err);
    }
  }

  async findOne(projectId: string, id: string) {
    const request = await this.prisma.aiRequest.findFirst({
      where: { id, projectId },
    });
    if (!request) {
      throw new NotFoundException('AI request not found');
    }
    return this.toPublic(request);
  }

  async listForProject(projectId: string) {
    const requests = await this.prisma.aiRequest.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return requests.map((r) => this.toPublic(r));
  }

  async apply(projectId: string, userId: string, id: string) {
    const request = await this.prisma.aiRequest.findFirst({
      where: { id, projectId },
    });
    if (!request) {
      throw new NotFoundException('AI request not found');
    }
    if (request.status !== 'PROPOSED' || !request.proposedDocument) {
      throw new BadRequestException(
        'This AI request has no pending proposal to apply.',
      );
    }

    // The only place an AI proposal ever becomes a real, saved design — it
    // goes through the exact same saveVersion path a manual save does.
    await this.projects.saveVersion(
      userId,
      projectId,
      request.proposedDocument as Record<string, unknown>,
    );
    const updated = await this.prisma.aiRequest.update({
      where: { id },
      data: { status: 'APPLIED', completedAt: new Date() },
    });
    return this.toPublic(updated);
  }

  async reject(projectId: string, id: string) {
    const request = await this.prisma.aiRequest.findFirst({
      where: { id, projectId },
    });
    if (!request) {
      throw new NotFoundException('AI request not found');
    }
    const updated = await this.prisma.aiRequest.update({
      where: { id },
      data: { status: 'REJECTED', completedAt: new Date() },
    });
    return this.toPublic(updated);
  }

  private async markProposed(
    id: string,
    proposedDocument: DesignDocument,
    summary: string,
  ) {
    const updated = await this.prisma.aiRequest.update({
      where: { id },
      data: {
        status: 'PROPOSED',
        proposedDocument: proposedDocument as unknown as Prisma.InputJsonValue,
        summary,
      },
    });
    return this.toPublic(updated);
  }

  private async markFailed(id: string, err: unknown) {
    this.logger.error(`AI request ${id} failed`, err);
    const updated = await this.prisma.aiRequest.update({
      where: { id },
      data: {
        status: 'FAILED',
        errorMessage: err instanceof Error ? err.message : 'Unknown AI error',
        completedAt: new Date(),
      },
    });
    return this.toPublic(updated);
  }

  // Never return the internal input image storage key — only a signed URL,
  // same convention as StorageService's other public-facing responses.
  private toPublic<T extends { inputImageKey: string | null }>(request: T) {
    const { inputImageKey, ...rest } = request;
    return {
      ...rest,
      inputImageUrl: inputImageKey
        ? this.storage.getSignedUrl(inputImageKey)
        : null,
    };
  }
}
