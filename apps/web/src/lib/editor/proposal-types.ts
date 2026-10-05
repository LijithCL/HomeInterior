import type { CostLineItem } from './cost-estimate';

export type ProposalStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED';

export interface Proposal {
  id: string;
  projectId: string;
  createdBy: string;
  status: ProposalStatus;
  title: string;
  notes: string | null;
  designFeeCents: number;
  lineItems: CostLineItem[];
  totalCents: number;
  shareToken: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicProposal {
  proposal: Proposal;
  projectName: string;
}
