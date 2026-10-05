import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const UNITS = ['mm', 'cm', 'm', 'ft'] as const;

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(UNITS)
  defaultUnit?: (typeof UNITS)[number];
}
