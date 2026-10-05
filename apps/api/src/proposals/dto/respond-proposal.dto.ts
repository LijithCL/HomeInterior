import { IsIn } from 'class-validator';

export class RespondProposalDto {
  @IsIn(['ACCEPTED', 'DECLINED'])
  status!: 'ACCEPTED' | 'DECLINED';
}
