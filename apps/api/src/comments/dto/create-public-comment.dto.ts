import { IsString, MaxLength, MinLength } from 'class-validator';
import { CreateCommentDto } from './create-comment.dto';

// Same shape as an authenticated comment, plus a required display name —
// there's no userId to fall back on for an anonymous share-link viewer.
export class CreatePublicCommentDto extends CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  authorName!: string;
}
