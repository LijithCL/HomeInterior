import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { BillingService } from './billing.service';
import { parseTier } from './billing.controller';

// Individual (non-team) billing — a solo user's own subscription, covering
// their personal projects, without ever creating a Team. Mirrors
// BillingController's routes one-for-one, just scoped to the current user
// instead of a :teamId (no owner-role check needed — it's always "your own"
// billing).
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class PersonalBillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  status(@CurrentUser() user: CurrentUserPayload) {
    return this.billingService.getPersonalBillingStatus(user.id);
  }

  @Get('subscription')
  subscription(@CurrentUser() user: CurrentUserPayload) {
    return this.billingService.getPersonalSubscriptionDetails(user.id);
  }

  @Get('payment-method')
  paymentMethod(@CurrentUser() user: CurrentUserPayload) {
    return this.billingService.getPersonalPaymentMethod(user.id);
  }

  @Get('invoices')
  invoices(@CurrentUser() user: CurrentUserPayload) {
    return this.billingService.listPersonalInvoices(user.id);
  }

  @Post('cancel')
  async cancel(@CurrentUser() user: CurrentUserPayload) {
    await this.billingService.cancelPersonalSubscription(user.id);
    return { success: true };
  }

  @Post('checkout')
  checkout(
    @CurrentUser() user: CurrentUserPayload,
    @Body('tier') tier: unknown,
  ) {
    return this.billingService.createPersonalCheckoutSession(
      user.id,
      parseTier(tier),
    );
  }

  @Post('portal')
  portal(@CurrentUser() user: CurrentUserPayload) {
    return this.billingService.createPersonalPortalSession(user.id);
  }
}
