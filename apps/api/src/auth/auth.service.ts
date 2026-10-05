import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const SALT_ROUNDS = 12;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(
    dto: RegisterDto,
  ): Promise<{ user: PublicUser; tokens: AuthTokens }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, name: dto.name },
    });

    return { user: toPublicUser(user), tokens: this.issueTokens(user) };
  }

  async login(
    dto: LoginDto,
  ): Promise<{ user: PublicUser; tokens: AuthTokens }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return { user: toPublicUser(user), tokens: this.issueTokens(user) };
  }

  async refresh(
    refreshToken: string,
  ): Promise<{ user: PublicUser; tokens: AuthTokens }> {
    let payload: { sub: string };
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return { user: toPublicUser(user), tokens: this.issueTokens(user) };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  private issueTokens(user: {
    id: string;
    email: string;
    role: string;
  }): AuthTokens {
    const basePayload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwt.sign(basePayload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env
        .JWT_ACCESS_TTL as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });
    const refreshToken = this.jwt.sign(basePayload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env
        .JWT_REFRESH_TTL as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });

    return { accessToken, refreshToken };
  }
}

function toPublicUser(user: {
  id: string;
  email: string;
  name: string | null;
  role: string;
}): PublicUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
