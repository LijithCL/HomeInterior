import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateGenerateDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  prompt!: string;
}
