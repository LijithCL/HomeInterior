import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

// Mirrors CostLineItem from apps/web/src/lib/editor/cost-estimate.ts — the
// proposal stores whatever the client already computed from live catalog
// prices as an opaque, frozen snapshot rather than recomputing pricing
// server-side.
export class ProposalLineItemDto {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsString()
  @IsNotEmpty()
  quantityLabel!: string;

  @IsInt()
  amountCents!: number;

  @IsOptional()
  @IsString()
  vendorUrl?: string;

  @IsOptional()
  @IsString()
  vendorName?: string;
}

export class CreateProposalDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  designFeeCents?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProposalLineItemDto)
  lineItems!: ProposalLineItemDto[];
}
