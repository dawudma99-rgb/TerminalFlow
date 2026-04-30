import { PublicShell } from '@/components/layout/PublicShell'
import { AiPortMonitor } from '@/components/marketing/AiPortMonitor'
import { HeroShowcase } from '@/components/marketing/HeroShowcase'
import { ScrollReveal } from '@/components/marketing/ScrollReveal'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  History,
  Layers3,
  Mail,
  Radar,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react'

const painPoints = [
  {
    icon: Clock3,
    title: 'Priorities reset every morning',
    copy: 'Teams rebuild urgency from spreadsheets, emails, and memory before any container actually moves forward.',
  },
  {
    icon: AlertTriangle,
    title: 'Charges surface after the damage',
    copy: 'Demurrage risk appears when the invoice arrives instead of when the team still has time to act.',
  },
  {
    icon: Layers3,
    title: 'Status lives in too many places',
    copy: 'Client updates, port notes, and internal ownership drift apart across disconnected tools.',
  },
]

const features = [
  {
    icon: Zap,
    title: 'Priority command center',
    copy: 'See overdue, at-risk, recently changed, and client-sensitive containers in one ranked view.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Spreadsheet-friendly intake',
    copy: 'Bring in the data your team already uses, then keep it clean without file versions.',
  },
  {
    icon: TrendingUp,
    title: 'Cost exposure tracking',
    copy: 'Project detention and demurrage risk before charges become unavoidable.',
  },
  {
    icon: Mail,
    title: 'Client-ready updates',
    copy: 'Generate consistent update drafts from live records and review them before sending.',
  },
  {
    icon: History,
    title: 'Change history',
    copy: 'Track who changed what, when it changed, and what was communicated.',
  },
  {
    icon: Radar,
    title: 'AI port signals',
    copy: 'Monitor dwell, delay patterns, and recurring bottlenecks across ports and lanes.',
  },
]

const workflow = [
  'Import container data',
  'Rank risk by urgency',
  'Review port signals',
  'Send client updates',
]

const productViews = [
  {
    label: 'Dashboard',
    title: 'A morning view built around action.',
    copy: 'The dashboard separates urgent exceptions from normal movement, so operators know where to start.',
    image: '/images/dashboard.png',
    alt: 'TerminalFlow dashboard',
  },
  {
    label: 'Containers',
    title: 'Operational records without spreadsheet drift.',
    copy: 'Filter containers by client, lane, list, milestone, and risk while keeping one shared source of truth.',
    image: '/images/containerspage.png',
    alt: 'TerminalFlow containers page',
  },
  {
    label: 'Analytics',
    title: 'Patterns that explain where risk is building.',
    copy: 'Track exposure, port performance, and status health before delays turn into avoidable cost.',
    image: '/images/analytics.png',
    alt: 'TerminalFlow analytics page',
  },
]

const replacements = [
  { icon: FileSpreadsheet, label: 'Versioned spreadsheets' },
  { icon: Mail, label: 'Manual update emails' },
  { icon: AlertTriangle, label: 'Late cost checks' },
  { icon: ShieldCheck, label: 'Memory-based ownership' },
]

export default function HomePage() {
  return (
    <PublicShell>
      <section className="relative isolate overflow-hidden bg-[#f7fafc]">
        <div className="absolute inset-x-0 top-0 -z-10 h-[44rem] bg-[linear-gradient(135deg,#ffffff_0%,#eef9fb_42%,#f8fafc_100%)]" />
        <div className="absolute left-0 top-28 -z-10 h-72 w-72 rounded-full bg-cyan-200/35 blur-3xl" />
        <div className="absolute right-0 top-10 -z-10 h-80 w-80 rounded-full bg-emerald-200/30 blur-3xl" />

        <div className="container mx-auto px-4 pb-16 pt-16 sm:px-6 sm:pb-20 sm:pt-20 lg:px-8 lg:pb-24 lg:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
            <ScrollReveal className="max-w-3xl" direction="right">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-sm font-medium text-cyan-800 shadow-sm">
                <Sparkles className="h-4 w-4" />
                Built for freight forwarding operations
              </div>
              <h1 className="text-5xl font-semibold leading-[0.95] tracking-[-0.02em] text-slate-950 sm:text-6xl lg:text-7xl">
                Stop finding demurrage risk after it is already expensive.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-650 sm:text-xl">
                TerminalFlow gives import teams a live operating layer for container priority, cost exposure, client communication, and AI-assisted port performance.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-lg bg-slate-950 px-6 text-base text-white shadow-lg shadow-slate-300 hover:bg-slate-800">
                  <Link href="/login">
                    Get early access
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 rounded-lg border-slate-300 bg-white px-6 text-base">
                  <Link href="/login">Login</Link>
                </Button>
              </div>
              <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
                {['Live container queue', '7-day cost projection', 'AI port signals'].map((item) => (
                  <div key={item} className="rounded-xl border border-slate-200 bg-white/80 p-4 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur">
                    {item}
                  </div>
                ))}
              </div>
            </ScrollReveal>

            <HeroShowcase />
          </div>
        </div>
      </section>

      <section className="bg-white py-14 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
            {painPoints.map((item, index) => (
              <ScrollReveal key={item.title} delay={index * 0.06}>
                <div className="h-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-800">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-950">{item.title}</h2>
                  <p className="mt-2 leading-7 text-slate-600">{item.copy}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="bg-slate-950 py-20 text-white sm:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <ScrollReveal direction="right">
              <p className="text-sm font-semibold uppercase text-cyan-300">Operating system</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.01em] sm:text-5xl">
                One calmer way to run the import desk.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-300">
                TerminalFlow is not another spreadsheet. It is the layer that turns container records into risk, priority, ownership, and communication.
              </p>
            </ScrollReveal>

            <div className="grid gap-4 sm:grid-cols-2">
              {features.map((feature, index) => (
                <ScrollReveal key={feature.title} delay={(index % 2) * 0.06} direction="left">
                  <div className="h-full rounded-xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur transition hover:-translate-y-1 hover:bg-white/[0.09]">
                    <feature.icon className="h-5 w-5 text-cyan-300" />
                    <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
                    <p className="mt-2 leading-7 text-slate-300">{feature.copy}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-20 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase text-cyan-700">Workflow</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.01em] text-slate-950 sm:text-5xl">
              From messy data to clear action.
            </h2>
          </ScrollReveal>

          <div className="mx-auto mt-12 grid max-w-6xl gap-4 md:grid-cols-4">
            {workflow.map((step, index) => (
              <ScrollReveal key={step} delay={index * 0.06}>
                <div className="relative min-h-36 rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-semibold text-cyan-700">0{index + 1}</p>
                  <p className="mt-8 text-xl font-semibold leading-7 text-slate-950">{step}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white pb-20 sm:pb-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="mx-auto max-w-6xl">
            <AiPortMonitor />
          </ScrollReveal>
        </div>
      </section>

      <section className="bg-[#f7fafc] py-20 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <ScrollReveal className="max-w-3xl">
              <p className="text-sm font-semibold uppercase text-cyan-700">Product views</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.01em] text-slate-950 sm:text-5xl">
                Built around the daily flow of import operations.
              </h2>
            </ScrollReveal>

            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {productViews.map((view, index) => (
                <ScrollReveal key={view.title} delay={index * 0.08}>
                  <div className="h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="p-6">
                      <p className="text-sm font-semibold uppercase text-cyan-700">{view.label}</p>
                      <h3 className="mt-3 text-2xl font-semibold text-slate-950">{view.title}</h3>
                      <p className="mt-3 leading-7 text-slate-600">{view.copy}</p>
                    </div>
                    <div className="border-t border-slate-200 bg-slate-100 p-2">
                      <Image
                        src={view.image}
                        alt={view.alt}
                        width={900}
                        height={580}
                        className="h-auto w-full rounded-lg border border-slate-200 bg-white"
                        sizes="(max-width: 1024px) 100vw, 31vw"
                      />
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-20 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-10 rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-xl sm:p-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <ScrollReveal direction="right">
              <p className="text-sm font-semibold uppercase text-cyan-300">Replaces</p>
              <h2 className="mt-3 text-3xl font-semibold sm:text-5xl">Less chasing. More control.</h2>
              <p className="mt-5 text-lg leading-8 text-slate-300">
                Keep the operational rhythm your team understands while removing the manual work that creates risk.
              </p>
            </ScrollReveal>
            <div className="grid gap-4 sm:grid-cols-2">
              {replacements.map((item, index) => (
                <ScrollReveal key={item.label} delay={index * 0.06} direction="left">
                  <div className="rounded-xl border border-white/10 bg-white/10 p-5">
                    <item.icon className="h-6 w-6 text-cyan-300" />
                    <p className="mt-5 text-lg font-semibold">{item.label}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white pb-20 sm:pb-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-semibold tracking-[-0.01em] text-slate-950 sm:text-5xl">
              Run tomorrow morning from one live container view.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Login takes the team straight into the software. The public landing page stays separate from the operating workspace.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 rounded-lg bg-slate-950 px-6 text-base text-white hover:bg-slate-800">
                <Link href="/login">Get early access</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-lg border-slate-300 bg-white px-6 text-base">
                <Link href="/login">Login</Link>
              </Button>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </PublicShell>
  )
}
