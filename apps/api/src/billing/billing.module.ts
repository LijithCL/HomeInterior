import { Module } from '@nestjs/common';
import { TeamsModule } from '../teams/teams.module';
import { BillingController } from './billing.controller';
import { PersonalBillingController } from './personal-billing.controller';
import { BillingWebhookController } from './billing-webhook.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [TeamsModule],
  controllers: [
    BillingController,
    PersonalBillingController,
    BillingWebhookController,
  ],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
