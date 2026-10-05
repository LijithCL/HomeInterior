import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { AddMemberDto } from './dto/add-member.dto';

const MEMBER_SELECT = {
  id: true,
  role: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true } },
} as const;

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateTeamDto) {
    return this.prisma.team.create({
      data: {
        name: dto.name,
        ownerId: userId,
        members: { create: { userId, role: 'OWNER' } },
      },
    });
  }

  async findAllForUser(userId: string) {
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId },
      include: { team: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({ ...m.team, myRole: m.role }));
  }

  // Doesn't leak team existence to non-members — a stranger guessing a
  // teamId gets the same 404 as a nonexistent one.
  private async requireMembership(userId: string, teamId: string) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!membership) throw new NotFoundException('Team not found');
    return membership;
  }

  private async requireOwner(userId: string, teamId: string) {
    const membership = await this.requireMembership(userId, teamId);
    if (membership.role !== 'OWNER') {
      throw new ForbiddenException('Only the team owner can do this');
    }
    return membership;
  }

  async findOneForUser(userId: string, teamId: string) {
    const membership = await this.requireMembership(userId, teamId);
    const team = await this.prisma.team.findUniqueOrThrow({
      where: { id: teamId },
      include: {
        members: { select: MEMBER_SELECT, orderBy: { createdAt: 'asc' } },
      },
    });
    return { ...team, myRole: membership.role };
  }

  async update(userId: string, teamId: string, dto: UpdateTeamDto) {
    await this.requireOwner(userId, teamId);
    return this.prisma.team.update({
      where: { id: teamId },
      data: { name: dto.name },
    });
  }

  async addMember(userId: string, teamId: string, dto: AddMemberDto) {
    await this.requireOwner(userId, teamId);

    const target = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!target) {
      throw new NotFoundException(
        'No registered user with that email — they need an account first',
      );
    }

    const existing = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: target.id } },
    });
    if (existing) {
      throw new ConflictException(
        'That person is already a member of this team',
      );
    }

    await this.prisma.teamMember.create({
      data: { teamId, userId: target.id, role: dto.role ?? 'EDITOR' },
    });
    return this.findOneForUser(userId, teamId);
  }

  async updateMemberRole(
    userId: string,
    teamId: string,
    memberUserId: string,
    role: 'EDITOR' | 'VIEWER',
  ) {
    await this.requireOwner(userId, teamId);
    const team = await this.prisma.team.findUniqueOrThrow({
      where: { id: teamId },
    });
    if (memberUserId === team.ownerId) {
      throw new ForbiddenException(
        "The team owner's role can't be changed here",
      );
    }
    await this.prisma.teamMember.update({
      where: { teamId_userId: { teamId, userId: memberUserId } },
      data: { role },
    });
    return this.findOneForUser(userId, teamId);
  }

  async removeMember(userId: string, teamId: string, memberUserId: string) {
    const membership = await this.requireMembership(userId, teamId);
    const team = await this.prisma.team.findUniqueOrThrow({
      where: { id: teamId },
    });
    if (memberUserId === team.ownerId) {
      throw new ForbiddenException(
        'The team owner cannot be removed — archive the team instead',
      );
    }
    // The owner can remove anyone; anyone else can only remove themselves
    // (leaving the team).
    if (membership.role !== 'OWNER' && memberUserId !== userId) {
      throw new ForbiddenException(
        'Only the team owner can remove other members',
      );
    }
    await this.prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId: memberUserId } },
    });
    return { success: true };
  }
}
