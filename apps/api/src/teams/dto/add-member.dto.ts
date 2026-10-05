import { IsEmail, IsIn, IsOptional } from 'class-validator';

export class AddMemberDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsIn(['EDITOR', 'VIEWER'])
  role?: 'EDITOR' | 'VIEWER';
}
