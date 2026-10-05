import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AssetsService } from '../assets/assets.service';
import type { StorageService } from '../storage/storage.service';
import type { UploadsService } from '../uploads/uploads.service';

// The permission model in one line: a project's own owner is always
// OWNER; otherwise access is exactly the caller's TeamMember role on the
// project's team, or no access at all. Every controller in the app
// (Projects, Render, AI, Sharing) trusts resolveAccess to get this right,
// so it's covered directly against a mocked Prisma rather than only
// indirectly through the e2e suite.
function makePrismaMock() {
  return {
    project: { findFirst: jest.fn() },
    teamMember: { findUnique: jest.fn() },
  };
}

describe('ProjectsService.resolveAccess', () => {
  const OWNER_ID = 'user-owner';
  const OTHER_USER_ID = 'user-other';
  const TEAM_ID = 'team-1';
  const PROJECT_ID = 'project-1';

  it('returns null when the project does not exist', async () => {
    const prisma = makePrismaMock();
    prisma.project.findFirst.mockResolvedValue(null);
    const service = new ProjectsService(
      prisma as unknown as PrismaService,
      {} as AssetsService,
      {} as unknown as StorageService,
      {} as unknown as UploadsService,
    );

    expect(await service.resolveAccess(OWNER_ID, PROJECT_ID)).toBeNull();
  });

  it("grants OWNER to the project's personal owner, without consulting team membership", async () => {
    const prisma = makePrismaMock();
    prisma.project.findFirst.mockResolvedValue({
      id: PROJECT_ID,
      ownerId: OWNER_ID,
      teamId: null,
    });
    const service = new ProjectsService(
      prisma as unknown as PrismaService,
      {} as AssetsService,
      {} as unknown as StorageService,
      {} as unknown as UploadsService,
    );

    const result = await service.resolveAccess(OWNER_ID, PROJECT_ID);
    expect(result?.access).toBe('OWNER');
    expect(prisma.teamMember.findUnique).not.toHaveBeenCalled();
  });

  it('grants no access to a non-owner when the project has no team', async () => {
    const prisma = makePrismaMock();
    prisma.project.findFirst.mockResolvedValue({
      id: PROJECT_ID,
      ownerId: OWNER_ID,
      teamId: null,
    });
    const service = new ProjectsService(
      prisma as unknown as PrismaService,
      {} as AssetsService,
      {} as unknown as StorageService,
      {} as unknown as UploadsService,
    );

    expect(await service.resolveAccess(OTHER_USER_ID, PROJECT_ID)).toBeNull();
  });

  it.each(['OWNER', 'EDITOR', 'VIEWER'] as const)(
    'maps a %s TeamMember role directly to the same ProjectAccessLevel',
    async (role) => {
      const prisma = makePrismaMock();
      prisma.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        ownerId: OWNER_ID,
        teamId: TEAM_ID,
      });
      prisma.teamMember.findUnique.mockResolvedValue({
        teamId: TEAM_ID,
        userId: OTHER_USER_ID,
        role,
      });
      const service = new ProjectsService(
        prisma as unknown as PrismaService,
        {} as AssetsService,
        {} as unknown as StorageService,
        {} as unknown as UploadsService,
      );

      const result = await service.resolveAccess(OTHER_USER_ID, PROJECT_ID);
      expect(result?.access).toBe(role);
    },
  );

  it('grants no access when the project has a team but the caller is not a member', async () => {
    const prisma = makePrismaMock();
    prisma.project.findFirst.mockResolvedValue({
      id: PROJECT_ID,
      ownerId: OWNER_ID,
      teamId: TEAM_ID,
    });
    prisma.teamMember.findUnique.mockResolvedValue(null);
    const service = new ProjectsService(
      prisma as unknown as PrismaService,
      {} as AssetsService,
      {} as unknown as StorageService,
      {} as unknown as UploadsService,
    );

    expect(await service.resolveAccess(OTHER_USER_ID, PROJECT_ID)).toBeNull();
  });

  it('findOneForUser throws NotFoundException (not Forbidden) for a total stranger', async () => {
    const prisma = makePrismaMock();
    prisma.project.findFirst.mockResolvedValue(null);
    const service = new ProjectsService(
      prisma as unknown as PrismaService,
      {} as AssetsService,
      {} as unknown as StorageService,
      {} as unknown as UploadsService,
    );

    await expect(
      service.findOneForUser(OTHER_USER_ID, PROJECT_ID),
    ).rejects.toThrow(NotFoundException);
  });

  it('requireEditAccess rejects a VIEWER but allows an EDITOR', async () => {
    const prisma = makePrismaMock();
    prisma.project.findFirst.mockResolvedValue({
      id: PROJECT_ID,
      ownerId: OWNER_ID,
      teamId: TEAM_ID,
    });
    const service = new ProjectsService(
      prisma as unknown as PrismaService,
      {} as AssetsService,
      {} as unknown as StorageService,
      {} as unknown as UploadsService,
    );

    prisma.teamMember.findUnique.mockResolvedValue({
      teamId: TEAM_ID,
      userId: OTHER_USER_ID,
      role: 'VIEWER',
    });
    await expect(
      service.requireEditAccess(OTHER_USER_ID, PROJECT_ID),
    ).rejects.toThrow(ForbiddenException);

    prisma.teamMember.findUnique.mockResolvedValue({
      teamId: TEAM_ID,
      userId: OTHER_USER_ID,
      role: 'EDITOR',
    });
    await expect(
      service.requireEditAccess(OTHER_USER_ID, PROJECT_ID),
    ).resolves.toBeDefined();
  });

  it('requireOwnerAccess rejects EDITOR and VIEWER, allows OWNER (personal or team)', async () => {
    const prisma = makePrismaMock();
    prisma.project.findFirst.mockResolvedValue({
      id: PROJECT_ID,
      ownerId: OWNER_ID,
      teamId: TEAM_ID,
    });
    const service = new ProjectsService(
      prisma as unknown as PrismaService,
      {} as AssetsService,
      {} as unknown as StorageService,
      {} as unknown as UploadsService,
    );

    prisma.teamMember.findUnique.mockResolvedValue({
      teamId: TEAM_ID,
      userId: OTHER_USER_ID,
      role: 'EDITOR',
    });
    await expect(
      service.requireOwnerAccess(OTHER_USER_ID, PROJECT_ID),
    ).rejects.toThrow(ForbiddenException);

    prisma.teamMember.findUnique.mockResolvedValue({
      teamId: TEAM_ID,
      userId: OTHER_USER_ID,
      role: 'OWNER',
    });
    await expect(
      service.requireOwnerAccess(OTHER_USER_ID, PROJECT_ID),
    ).resolves.toBeDefined();

    await expect(
      service.requireOwnerAccess(OWNER_ID, PROJECT_ID),
    ).resolves.toBeDefined();
  });
});
