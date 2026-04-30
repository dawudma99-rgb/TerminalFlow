import { PublicShell } from '@/components/layout/PublicShell'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react'

const plans = [
  {
    name: 'Early Access',
    price: 'Let\'s talk',
    description: 'For teams ready to move real container workflows out of spreadsheets.',
    cta: 'Get early access',
    href: '/login',
    featured: true,
    features: [
      'Up to 5 users',
      'Unlimited container tracking',
      'Safe, warning, and overdue risk states',
      'CSV and Excel import',
      'Client update workflow',
      'AI port performance monitoring',
      'Priority onboarding support',
    ],
  },
  {
    name: 'Team',
    price: 'Custom',
    description: 'For forwarding teams with more users, more lists, and higher operational volume.',
    cta: 'Talk to us',
    href: 'mailto:sales@terminalflow.app?subject=TerminalFlow%20Team%20Plan',
    featured: false,
    features: [
      'Everything in Early Access',
      'Additional users and teams',
      'Multiple operational lists',
      'Spreadsheet migration support',
      'Dedicated onboarding call',
      'Workflow setup guidance',
    ],
  },
]

export default function PricingPage() {
  return (
    <PublicShell>
      <section className="relative isolate overflow-hidden bg-[#f7fafc] py-20 sm:py-24">
        <div className="absolute left-0 top-16 -z-10 h-72 w-72 rounded-full bg-cyan-200/35 blur-3xl" />
        <div className="absolute right-0 top-32 -z-10 h-80 w-80 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-sm font-medium text-cyan-800 shadow-sm">
              <Sparkles className="h-4 w-4" />
              Pricing for freight forwarding teams
            </div>
            <h1 className="text-5xl font-semibold leading-[0.98] tracking-[-0.02em] text-slate-950 sm:text-6xl">
              Simple pricing that protects margin.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Start with the workflows that create the most risk: container priority, cost exposure, client updates, and AI-monitored port performance.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-5xl gap-5 lg:grid-cols-2">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-6 shadow-sm ${
                  plan.featured
                    ? 'border-slate-950 bg-slate-950 text-white shadow-xl'
                    : 'border-slate-200 bg-white text-slate-950'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold">{plan.name}</h2>
                    <p className={`mt-3 leading-7 ${plan.featured ? 'text-slate-300' : 'text-slate-600'}`}>
                      {plan.description}
                    </p>
                  </div>
                  {plan.featured && (
                    <span className="rounded-full bg-cyan-300 px-3 py-1 text-xs font-semibold text-slate-950">
                      Recommended
                    </span>
                  )}
                </div>

                <div className="mt-8">
                  <p className="text-4xl font-semibold">{plan.price}</p>
                  <p className={`mt-2 text-sm ${plan.featured ? 'text-slate-400' : 'text-slate-500'}`}>
                    Built around your team size and container volume.
                  </p>
                </div>

                <Button
                  asChild
                  size="lg"
                  variant={plan.featured ? 'secondary' : 'outline'}
                  className="mt-8 h-12 w-full rounded-lg text-base"
                >
                  <Link href={plan.href}>
                    {plan.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>

                <div className="mt-8 space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <CheckCircle2 className={`mt-0.5 h-5 w-5 ${plan.featured ? 'text-cyan-300' : 'text-emerald-600'}`} />
                      <span className={plan.featured ? 'text-slate-200' : 'text-slate-700'}>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-5xl gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">Not sure which plan fits?</h2>
              <p className="mt-3 leading-7 text-slate-600">
                Tell us your team size, container volume, and current spreadsheet workflow. We will help you choose the cleanest starting point.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="rounded-lg">
                  <a href="mailto:sales@terminalflow.app?subject=TerminalFlow%20Pricing%20Question">
                    Ask about pricing
                  </a>
                </Button>
                <Button asChild variant="outline" className="rounded-lg">
                  <Link href="/">Back to landing page</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  )
}
