import { IsObject } from 'class-validator';

export class SaveVersionDto {
  @IsObject()
  document!: Record<string, unknown>;
}
