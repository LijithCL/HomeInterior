import { IsISO8601, IsOptional } from 'class-validator';

export class CreateShareLinkDto {
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
