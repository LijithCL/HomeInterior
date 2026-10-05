import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { ListAssetsQuery } from './dto/list-assets.query';

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async findAll(query: ListAssetsQuery = {}) {
    const assets = await this.prisma.asset.findMany({
      where: {
        isActive: query.includeInactive === 'true' ? undefined : true,
        category: query.category,
        name: query.q ? { contains: query.q, mode: 'insensitive' } : undefined,
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return assets.map((asset) => this.toPublic(asset));
  }

  async create(dto: CreateAssetDto) {
    const asset = await this.prisma.asset.create({
      data: {
        category: dto.category,
        name: dto.name,
        defaultWidthMm: dto.defaultWidthMm,
        defaultDepthMm: dto.defaultDepthMm,
        defaultHeightMm: dto.defaultHeightMm,
        color: dto.color,
        thumbnailKey: dto.thumbnailKey,
        priceCents: dto.priceCents,
        vendorName: dto.vendorName,
        vendorUrl: dto.vendorUrl,
      },
    });
    return this.toPublic(asset);
  }

  async update(id: string, dto: UpdateAssetDto) {
    await this.findOneOrThrow(id);
    const asset = await this.prisma.asset.update({ where: { id }, data: dto });
    return this.toPublic(asset);
  }

  async remove(id: string) {
    await this.findOneOrThrow(id);
    await this.prisma.asset.update({
      where: { id },
      data: { isActive: false },
    });
    return { success: true };
  }

  private async findOneOrThrow(id: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }
    return asset;
  }

  // Never return the raw storage key — only a short-lived signed URL.
  private toPublic<T extends { thumbnailKey: string | null }>(asset: T) {
    const { thumbnailKey, ...rest } = asset;
    return {
      ...rest,
      thumbnailUrl: thumbnailKey
        ? this.storage.getSignedUrl(thumbnailKey)
        : null,
    };
  }
}
