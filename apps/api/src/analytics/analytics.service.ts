import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from '../teams/teams.service';

const RENDER_STATUSES = ['QUEUED', 'PROCESSING', 'DONE', 'FAILED'] as const;
const AI_STATUSES = [
  'PENDING',
  'PROPOSED',
  'APPLIED',
  'REJECTED',
  'FAILED',
] as const;

function zeroFillCounts<S extends string>(
  groups: { status: S; _count: number }[],
  statuses: readonly S[],
): Record<S, number> {
  const counts = Object.fromEntries(statuses.map((s) => [s, 0])) as Record<
    S,
    number
  >;
  for (const g of groups) counts[g.status] = g._count;
  return counts;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamsService: TeamsService,
  ) {}

  // Personal scope (no teamId) is "projects I created", regardless of
  // whether any of them are also shared with a team — a team's own scope
  // is a separate lens on its own project set. Both are read-only
  // aggregates computed on the fly; no separate analytics event pipeline.
  async getSummary(userId: string, teamId?: string) {
    let projectIds: string[];
    let memberCount: number | undefined;

    if (teamId) {
      await this.teamsService.findOneForUser(userId, teamId); // throws if not a member
      const [projects, count] = await Promise.all([
        this.prisma.project.findMany({
          where: { teamId, deletedAt: null },
          select: { id: true },
        }),
        this.prisma.teamMember.count({ where: { teamId } }),
      ]);
      projectIds = projects.map((p) => p.id);
      memberCount = count;
    } else {
      const projects = await this.prisma.project.findMany({
        where: { ownerId: userId, deletedAt: null },
        select: { id: true },
      });
      projectIds = projects.map((p) => p.id);
    }

    const [renderGroups, aiGroups] = await Promise.all([
      this.prisma.renderJob.groupBy({
        by: ['status'],
        where: { projectId: { in: projectIds } },
        _count: true,
      }),
      this.prisma.aiRequest.groupBy({
        by: ['status'],
        where: { projectId: { in: projectIds } },
        _count: true,
      }),
    ]);

    return {
      scope: teamId ? ('team' as const) : ('personal' as const),
      projectCount: projectIds.length,
      memberCount,
      renderJobs: zeroFillCounts(renderGroups, RENDER_STATUSES),
      aiRequests: zeroFillCounts(aiGroups, AI_STATUSES),
    };
  }
}
