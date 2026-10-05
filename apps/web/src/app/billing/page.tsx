import { redirect } from 'next/navigation';
import { ApiError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/session';
import type { BillingStatus, InvoiceSummary, PaymentMethodInfo, SubscriptionDetails } from '@/lib/teams/types';
import { AccountNav } from '@/components/AccountNav';
import {
  getPersonalBillingStatusAction,
  getPersonalInvoicesAction,
  getPersonalPaymentMethodAction,
  getPersonalSubscriptionDetailsAction,
} from '@/lib/billing-actions';
import { PersonalBillingPanel } from './PersonalBillingPanel';
import { PersonalPortalButton } from './PersonalPortalButton';

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount / 100);
}

export default async function PersonalBillingPage() {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  let billing: BillingStatus;
  let subscription: SubscriptionDetails;
  let paymentMethod: PaymentMethodInfo | null;
  let invoices: InvoiceSummary[];
  try {
    [billing, subscription, paymentMethod, invoices] = await Promise.all([
      getPersonalBillingStatusAction(),
      getPersonalSubscriptionDetailsAction(),
      getPersonalPaymentMethodAction(),
      getPersonalInvoicesAction(),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    throw err;
  }

  return (
    <div className="min-h-screen bg-cream">
      <AccountNav active="/billing" />

      <div className="px-6 py-10 sm:px-10">
        <h1 className="mb-8 text-2xl font-semibold text-neutral-900">Billing</h1>

        <div className="flex flex-col gap-6">
          <section className="rounded-lg border border-neutral-200 bg-white p-6">
            <PersonalBillingPanel initialStatus={billing} subscription={subscription} />
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold text-neutral-900">Payment method</h2>
            {paymentMethod ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-14 items-center justify-center rounded border border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase text-neutral-600">
                    {paymentMethod.brand}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">•••• {paymentMethod.last4}</p>
                    <p className="text-xs text-neutral-500">
                      Expires {String(paymentMethod.expMonth).padStart(2, '0')}/{paymentMethod.expYear}
                    </p>
                  </div>
                </div>
                {billing.configured && <PersonalPortalButton label="Update payment method" />}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-neutral-500">No payment method on file yet.</p>
                {billing.configured && billing.planTier !== 'FREE' && (
                  <PersonalPortalButton label="Add payment method" />
                )}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold text-neutral-900">Billing history</h2>
            {invoices.length === 0 ? (
              <p className="text-sm text-neutral-500">No invoices yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {invoices.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium text-neutral-900">
                        {formatAmount(invoice.amountPaid, invoice.currency)}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {formatDate(invoice.created)} · {invoice.status}
                      </p>
                    </div>
                    <div className="flex gap-3 text-xs">
                      {invoice.hostedInvoiceUrl && (
                        <a
                          href={invoice.hostedInvoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent hover:underline"
                        >
                          View
                        </a>
                      )}
                      {invoice.invoicePdf && (
                        <a
                          href={invoice.invoicePdf}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent hover:underline"
                        >
                          Download PDF
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
