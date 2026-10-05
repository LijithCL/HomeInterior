import { IsIn, IsOptional, IsString } from 'class-validator';

const ASSET_CATEGORIES = [
  'DOOR',
  'WINDOW',
  'FURNITURE',
  'KITCHEN',
  'BATHROOM',
  'ELECTRICAL',
  'DECORATION',
  'EXTERIOR',
] as const;

export class ListAssetsQuery {
  @IsOptional()
  @IsIn(ASSET_CATEGORIES)
  category?: (typeof ASSET_CATEGORIES)[number];

  @IsOptional()
  @IsString()
  q?: string;

  // Admin management view needs to see inactive (soft-deleted) assets too.
  @IsOptional()
  @IsString()
  includeInactive?: string;
}
