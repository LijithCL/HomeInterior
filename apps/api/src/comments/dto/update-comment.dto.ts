import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateCommentDto {
  @IsOptional()
  @IsBoolean()
  resolved?: boolean;
}
