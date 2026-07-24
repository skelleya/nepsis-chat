import { useState } from 'react'

type PlanId = 'free' | 'nous'

const PLANS: {
  id: PlanId
  name: string
  price: string
  blurb: string
  features: string[]
}[] = [
  {
    id: 'free',
    name: 'Nepsis Free',
    price: '$0',
    blurb: 'Core chat, voice, and community features.',
    features: [
      'Unlimited text & voice channels',
      'Screen share & cameras',
      'Custom emojis on your servers',
      'Desktop app with updates',
    ],
  },
  {
    id: 'nous',
    name: 'Nous',
    price: '$9.99/mo',
    blurb: 'Premium template — higher limits and polish for power users.',
    features: [
      'Higher upload & quality caps (template)',
      'Animated avatar & profile flair (template)',
      'Priority support queue (template)',
      'Early access to experimental voice features (template)',
      'Custom Nous badge on your profile (template)',
    ],
  },
]

/**
 * Settings → Nous subscription.
 * UI templates for plan, billing, and payment — billing backend not wired yet.
 */
export function NousSubscriptionSettingsTab() {
  // Template state only — replace with real billing API later.
  const [currentPlan] = useState<PlanId>('free')
  const [billingInterval] = useState<'monthly' | 'yearly'>('monthly')

  return (
    <div>
      <h3 className="mb-1 text-xl font-bold text-app-text">Nous subscription</h3>
      <p className="mb-4 text-sm text-app-muted">
        Manage your Nous plan and billing. Checkout is a template for now — no charges will be made.
      </p>

      <section className="mb-4 rounded-lg border border-app-accent/30 bg-app-accent/10 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-app-accent">Current plan</p>
            <h4 className="mt-1 text-lg font-semibold text-app-text">
              {PLANS.find((p) => p.id === currentPlan)?.name ?? 'Nepsis Free'}
            </h4>
            <p className="mt-0.5 text-sm text-app-muted">
              Status: <span className="text-app-text">Active</span>
              {' · '}
              Renews: <span className="text-app-text">—</span>
            </p>
          </div>
          <span className="rounded-md bg-app-darker/80 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-app-muted">
            Template
          </span>
        </div>
      </section>

      <section className="mb-4 grid gap-3 sm:grid-cols-2">
        {PLANS.map((plan) => {
          const selected = plan.id === currentPlan
          return (
            <article
              key={plan.id}
              className={`rounded-lg border p-4 ${
                selected
                  ? 'border-app-accent/50 bg-app-channel'
                  : 'border-app-glass/10 bg-app-darker/60'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="font-semibold text-app-text">{plan.name}</h4>
                <span className="text-sm font-medium text-app-muted">{plan.price}</span>
              </div>
              <p className="mt-1 text-xs text-app-muted">{plan.blurb}</p>
              <ul className="mt-3 space-y-1.5">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="relative pl-3 text-sm text-app-muted before:absolute before:left-0 before:text-app-accent before:content-['•']"
                  >
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled
                title="Billing coming soon"
                className="mt-4 w-full rounded-lg bg-app-glass/10 px-3 py-2 text-sm font-medium text-app-muted disabled:cursor-not-allowed"
              >
                {selected ? 'Current plan' : plan.id === 'nous' ? 'Upgrade to Nous (soon)' : 'Select'}
              </button>
            </article>
          )
        })}
      </section>

      <section className="mb-4 rounded-lg bg-app-channel p-4">
        <h4 className="font-semibold text-app-text">Billing</h4>
        <p className="mt-1 text-xs text-app-muted">Payment method and invoices will appear here.</p>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-app-glass/10 bg-app-darker/50 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-app-text">Payment method</p>
              <p className="text-xs text-app-muted">No card on file</p>
            </div>
            <button
              type="button"
              disabled
              className="rounded-md px-2.5 py-1 text-xs font-medium text-app-muted disabled:cursor-not-allowed"
            >
              Add card
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-app-glass/10 bg-app-darker/50 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-app-text">Billing interval</p>
              <p className="text-xs text-app-muted capitalize">{billingInterval} (template)</p>
            </div>
            <button
              type="button"
              disabled
              className="rounded-md px-2.5 py-1 text-xs font-medium text-app-muted disabled:cursor-not-allowed"
            >
              Change
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-lg bg-app-channel p-4">
        <h4 className="font-semibold text-app-text">Billing history</h4>
        <div className="mt-3 overflow-hidden rounded-lg border border-app-glass/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-app-darker/80 text-[11px] uppercase tracking-wide text-app-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Description</th>
                <th className="px-3 py-2 font-semibold">Amount</th>
                <th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-app-glass/10">
                <td colSpan={4} className="px-3 py-4 text-center text-app-muted">
                  No invoices yet — billing history is a template.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-app-muted">
          Need help with a charge? Use the title-bar Support button or Help & Support → support ticket.
        </p>
      </section>
    </div>
  )
}
