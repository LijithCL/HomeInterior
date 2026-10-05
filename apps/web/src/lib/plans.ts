import type { PlanTier } from './teams/types';

export const TRIAL_DAYS = 30;

export interface PlanInfo {
  tier: PlanTier;
  name: string;
  priceMonthly: number;
  tagline: string;
  features: string[];
}

export const PLAN_CATALOG: PlanInfo[] = [
  {
    tier: 'FREE',
    name: 'Free',
    priceMonthly: 0,
    tagline: 'Try the basics, no card required.',
    features: [
      '1 active project',
      '2D + 3D editor',
      'Standard preview renders',
      'View-only share links',
      'Community support',
    ],
  },
  {
    tier: 'PRO',
    name: 'Pro',
    priceMonthly: 19,
    tagline: 'For serious solo designers and small teams.',
    features: [
      'Unlimited projects',
      'HQ renders',
      'AI design assistant',
      'Team collaboration (up to 5 members)',
      'Priority support',
    ],
  },
  {
    tier: 'ULTIMATE',
    name: 'Ultimate',
    priceMonthly: 49,
    tagline: 'For studios and growing teams.',
    features: [
      'Everything in Pro',
      'Unlimited team members',
      'Unlimited AI generations',
      'Dedicated support',
      'Early access to new features',
    ],
  },
];
