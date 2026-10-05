import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { RespondProposalDto } from './dto/respond-proposal.dto';

// Deliberately outside JwtAuthGuard — a proposal's client-facing link is
// meant for whoever the designer sends it to, with no account required.
// Same no-auth model as ShareViewController (see sharing/share-view.controller.ts).
@Controller('proposal-view')
export class ProposalViewController {
  constructor(private readonly proposals: ProposalsService) {}

  @Get(':token')
  resolve(@Param('token') token: string) {
    return this.proposals.resolvePublic(token);
  }

  @Post(':token/respond')
  respond(@Param('token') token: string, @Body() dto: RespondProposalDto) {
    return this.proposals.respondPublic(token, dto.status);
  }
}
