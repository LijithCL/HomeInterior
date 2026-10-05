import {
  IsHexColor,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';

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

export class CreateAssetDto {
  @IsIn(ASSET_CATEGORIES)
  category!: (typeof ASSET_CATEGORIES)[number];

  @IsString()
  @MinLength(1)
  name!: string;

  @IsInt()
  @Min(1)
  defaultWidthMm!: number;

  @IsInt()
  @Min(1)
  defaultDepthMm!: number;

  @IsInt()
  @Min(1)
  defaultHeightMm!: number;

  @IsHexColor()
  color!: string;

  @IsOptional()
  @IsString()
  thumbnailKey?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  vendorName?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  vendorUrl?: string;
}
