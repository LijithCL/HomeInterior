import { IsOptional, IsString } from 'class-validator';

export class SetTeamDto {
  // Omit or null to move the project back to purely personal ownership.
  @IsOptional()
  @IsString()
  teamId?: string | null;
}
