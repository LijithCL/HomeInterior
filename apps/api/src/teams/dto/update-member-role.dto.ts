import { IsIn } from 'class-validator';

// OWNER is deliberately not settable here — ownership transfer is a
// separate, more sensitive operation this phase doesn't build; the
// owner's own membership row keeps its OWNER role for as long as they own
// the team (see TeamsService).
export class UpdateMemberRoleDto {
  @IsIn(['EDITOR', 'VIEWER'])
  role!: 'EDITOR' | 'VIEWER';
}
