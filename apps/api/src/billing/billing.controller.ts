import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { TeamsService } from '../teams/teams.service';
import { BillingService, type PaidTier } from './billing.service';

export function parseTier(value: unknown): PaidTier {
  if (value === 'PRO' || value === 'ULTIMATE') return value;
  throw new BadRequestException("tier must be 'PRO' or 'ULTIMATE'");
}

@UseGuards(JwtAuthGuard)
@Controller('teams/:teamId/billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly teamsService: TeamsService,
  ) {}

  @Get()
  async status(
    @CurrentUser() user: CurrentUserPayload,
    @Param('teamId') teamId: string,
  ) {
    await this.teamsService.findOneForUser(user.id, teamId);
    return this.billingService.getTeamBillingStatus(teamId);
  }

  @Get('subscription')
  async subscription(
    @CurrentUser() user: CurrentUserPayload,
    @Param('teamId') teamId: string,
  ) {
    await this.teamsService.findOneForUser(user.id, teamId);
    return this.billingService.getSubscriptionDetails(teamId);
  }

  @Get('payment-method')
  async paymentMethod(
    @CurrentUser() user: CurrentUserPayload,
    @Param('teamId') teamId: string,
  ) {
    await this.teamsService.findOneForUser(user.id, teamId);
    return this.billingService.getPaymentMethod(teamId);
  }

  @Get('invoices')
  async invoices(
    @CurrentUser() user: CurrentUserPayload,
    @Param('teamId') teamId: string,
  ) {
    await this.teamsService.findOneForUser(user.id, teamId);
    return this.billingService.listInvoices(teamId);
  }

  @Post('cancel')
  async cancel(
    @CurrentUser() user: CurrentUserPayload,
    @Param('teamId') teamId: string,
  ) {
    await this.requireTeamOwner(user, teamId);
    await this.billingService.cancelSubscription(teamId);
    return { success: true };
  }

  @Post('checkout')
  async checkout(
    @CurrentUser() user: CurrentUserPayload,
    @Param('teamId') teamId: string,
    @Body('tier') tier: unknown,
  ) {
    await this.requireTeamOwner(user, teamId);
    return this.billingService.createCheckoutSession(
      user.id,
      teamId,
      parseTier(tier),
    );
  }

  @Post('portal')
  async portal(
    @CurrentUser() user: CurrentUserPayload,
    @Param('teamId') teamId: string,
  ) {
    await this.requireTeamOwner(user, teamId);
    return this.billingService.createPortalSession(teamId);
  }

  private async requireTeamOwner(user: CurrentUserPayload, teamId: string) {
    const team = await this.teamsService.findOneForUser(user.id, teamId);
    if (team.myRole !== 'OWNER') {
      throw new ForbiddenException('Only the team owner can manage billing');
    }
  }
}
