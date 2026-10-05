import { IsObject, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateEditDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  prompt!: string;

  // The editor's current unsaved document — scoped edits are proposed
  // against whatever the user is actively looking at, not just the last
  // saved DesignVersion.
  @IsObject()
  document!: Record<string, unknown>;
}
