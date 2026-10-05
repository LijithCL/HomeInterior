import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateProfileDto } from '../auth/dto/update-profile.dto';

const PUBLIC_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  defaultUnit: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublicById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: PUBLIC_SELECT,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.defaultUnit !== undefined
          ? { defaultUnit: dto.defaultUnit }
          : {}),
      },
      select: PUBLIC_SELECT,
    });
  }
}
