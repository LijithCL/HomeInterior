import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { chromium } from 'playwright-core';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { BillingService } from '../billing/billing.service';
import { NotificationsService } from '../notifications/notifications.service';

const TIER_VIEWPORTS: Record<
  'PREVIEW' | 'HQ',
  { width: number; height: number }
> = {
  PREVIEW: { width: 640, height: 480 },
  HQ: { width: 1600, height: 1200 },
};

// A render "worker" that's just a fire-and-forget async call in this same
// process, driving a headless browser against our own /render page rather
// than running a separate server-side 3D renderer — it reuses the exact
// Scene3D code the editor already has. No queue/Redis yet (see the
// RenderJob model comment); fine at this scale, revisit if render load
// ever becomes concurrent/heavy enough to need one.
@Injectable()
export class RenderService {
  private readonly logger = new Logger(RenderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly storage: StorageService,
    private readonly billing: BillingService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(projectId: string, requestedBy: string, tier: 'PREVIEW' | 'HQ') {
    if (tier === 'HQ') {
      const project = await this.prisma.project.findUniqueOrThrow({
        where: { id: projectId },
      });
      const plan = await this.billing.getEffectivePlan(project);
      if (plan !== 'PRO' && plan !== 'ULTIMATE') {
        throw new ForbiddenException(
          "HQ rendering requires a Pro or Ultimate plan — upgrade the project's team to unlock it.",
        );
      }
    }

    const job = await this.prisma.renderJob.create({
      data: { projectId, requestedBy, tier },
    });
    void this.process(job.id).catch((err) =>
      this.logger.error(`Render job ${job.id} failed`, err),
    );
    return { ...job, outputUrl: null };
  }

  async findOne(projectId: string, id: string) {
    const job = await this.prisma.renderJob.findFirst({
      where: { id, projectId },
    });
    if (!job) {
      throw new NotFoundException('Render job not found');
    }
    return {
      ...job,
      outputUrl: job.outputKey
        ? this.storage.getSignedUrl(job.outputKey)
        : null,
    };
  }

  private async process(jobId: string) {
    const job = await this.prisma.renderJob.update({
      where: { id: jobId },
      data: { status: 'PROCESSING' },
    });

    try {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: job.requestedBy },
      });
      const renderToken = this.jwt.sign(
        { sub: user.id, email: user.email, role: user.role },
        { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '2m' },
      );

      const { width, height } = TIER_VIEWPORTS[job.tier];
      const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
      const url = `${webOrigin}/render/${job.projectId}?token=${encodeURIComponent(renderToken)}`;

      const browser = await chromium.launch({
        executablePath: process.env.CHROME_EXECUTABLE_PATH,
        headless: true,
      });
      try {
        const page = await browser.newPage({ viewport: { width, height } });
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
        // Let the R3F canvas mount and shadows settle before capturing —
        // simpler than wiring an explicit "ready" signal across the
        // Nest -> browser boundary, at the cost of a fixed fudge factor.
        await page.waitForTimeout(2500);
        // Screenshot just the <canvas>, not the full page — the render
        // page's camera-preset/time-of-day overlay buttons live in regular
        // DOM elements alongside it and shouldn't end up baked into the image.
        const buffer = await page.locator('canvas').screenshot({ type: 'png' });

        const key = `render-${jobId}.png`;
        await this.storage.put(key, buffer);

        await this.prisma.renderJob.update({
          where: { id: jobId },
          data: { status: 'DONE', outputKey: key, completedAt: new Date() },
        });
        await this.notifications.create({
          userId: job.requestedBy,
          type: 'RENDER_COMPLETED',
          title: `Your ${job.tier === 'HQ' ? 'high quality' : 'preview'} render is ready`,
          projectId: job.projectId,
          linkPath: `/editor/${job.projectId}`,
        });
      } finally {
        await browser.close();
      }
    } catch (err) {
      await this.prisma.renderJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          errorMessage:
            err instanceof Error ? err.message : 'Unknown render error',
          completedAt: new Date(),
        },
      });
    }
  }
}
