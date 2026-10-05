import { IsIn } from 'class-validator';

export class CreateRenderJobDto {
  @IsIn(['PREVIEW', 'HQ'])
  tier!: 'PREVIEW' | 'HQ';
}
