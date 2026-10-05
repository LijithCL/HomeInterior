export type TeamRole = 'OWNER' | 'EDITOR' | 'VIEWER';
export type PlanTier = 'FREE' | 'PRO' | 'ULTIMATE';
export type PaidTier = 'PRO' | 'ULTIMATE';

export interface TeamSummary {
  id: string;
  name: string;
  ownerId: string;
  planTier: PlanTier;
  myRole: TeamRole;
}

export interface TeamMemberRow {
  id: string;
  role: TeamRole;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
}

export interface TeamDetail extends TeamSummary {
  stripeSubscriptionStatus: string | null;
  createdAt: string;
  updatedAt: string;
  members: TeamMemberRow[];
}

export interface BillingStatus {
  configured: boolean;
  planTier: PlanTier;
  subscriptionStatus: string | null;
  trialUsed: boolean;
  trialAvailable: boolean;
}

export interface AnalyticsSummary {
  scope: 'personal' | 'team';
  projectCount: number;
  memberCount?: number;
  renderJobs: Record<string, number>;
  aiRequests: Record<string, number>;
}

export interface SubscriptionDetails {
  planTier: PlanTier;
  status: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null;
  trialEnd: number | null;
  priceAmount: number | null;
  currency: string | null;
}

export interface PaymentMethodInfo {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface InvoiceSummary {
  id: string;
  amountPaid: number;
  currency: string;
  status: string | null;
  created: number;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
}
