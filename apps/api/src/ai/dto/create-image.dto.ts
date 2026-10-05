import { IsOptional, IsString, MaxLength } from 'class-validator';

// Multipart form fields alongside the uploaded photo (see AiController's
// @UseInterceptors(FileInterceptor('file'))). `document` arrives as a JSON
// string because multipart form fields are always strings — the
// controller parses it, matching the pattern already used for uploads
// elsewhere in this module.
export class CreateImageDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  prompt?: string;

  @IsString()
  document!: string;
}
