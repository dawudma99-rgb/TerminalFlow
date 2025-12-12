import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PublicShell } from '@/components/layout/PublicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import Image from 'next/image'
import { Clock, Layers, AlertTriangle, ShieldCheck, ListChecks, TrendingUp, Mail, BarChart3, FileText, FileSpreadsheet, MessageSquare, Brain, CheckCircle } from 'lucide-react'

export default async function HomePage() {
  // Check if user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // If authenticated, redirect to dashboard
  if (user) {
    redirect('/dashboard')
  }

  // If not authenticated, show marketing landing page
  return (
    <PublicShell>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        {/* Background image */}
        <div className="absolute inset-0">
          <Image
            src="/images/logistics-hero.jpg"
            alt="Container ships being loaded at a busy terminal"
            fill
            className="object-cover object-center opacity-75"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/80 to-slate-950/30" />
        </div>

        {/* Foreground content */}
        <div className="relative">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-28">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-10 lg:gap-16 items-center">
              {/* LEFT: text + buttons */}
              <div className="max-w-xl space-y-6">
                <div className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-slate-100 mb-3">
                  Built for freight forwarders
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white">
                  Stop losing money to demurrage.
                </h1>
                <p className="text-xl text-slate-200 leading-relaxed">
                  TerminalFlow gives freight forwarders a single operational view of import containers — so teams can see current status, identify priority actions, and understand cost exposure.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <Link href="/login">
                    <Button size="lg" className="w-full sm:w-auto">
                      Get early access
                    </Button>
                  </Link>
                  <a
                    href="mailto:sales@terminalflow.app?subject=Book a 15-minute walkthrough"
                    className="text-sm text-slate-300 hover:text-blue-300 underline"
                  >
                    Book a 15-minute walkthrough
                  </a>
                </div>
              </div>

              {/* RIGHT: small stat/summary card */}
              <div className="max-w-md lg:justify-self-end lg:mr-8">
                <div className="rounded-2xl bg-white/10 backdrop-blur shadow-xl border border-white/10 p-5 space-y-4">
                  <p className="text-sm font-medium text-slate-100 uppercase tracking-wide">
                    Demurrage is avoidable
                  </p>
                  <p className="text-xl font-semibold text-white">
                    Clarity on status and priority.
                  </p>
                  <p className="text-sm text-slate-200/80">
                    View container status across your operation, identify which items require action, and understand where delays and charges are emerging — before invoices arrive.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Operational Problem */}
      <section className="py-20 sm:py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 mb-12 text-center">
              The operational problem
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex gap-5">
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Clock className="w-7 h-7 text-slate-700" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    No operational prioritisation
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    No clear distinction between what needs action today and what can wait.
                  </p>
                </div>
              </div>
              <div className="flex gap-5">
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Layers className="w-7 h-7 text-slate-700" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    Fragmented container visibility
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    Information scattered across spreadsheets, emails, and memory.
                  </p>
                </div>
              </div>
              <div className="flex gap-5">
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7 text-slate-700" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    Reactive cost exposure
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    Charges discovered after the invoice arrives.
                  </p>
                </div>
              </div>
              <div className="flex gap-5">
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <ShieldCheck className="w-7 h-7 text-slate-700" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    No accountability trail
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    No record of who changed what, when, or what was communicated.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What TerminalFlow Gives You */}
      <section className="py-20 sm:py-24 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 mb-12 text-center">
              What TerminalFlow gives you
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex gap-5">
                  <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <ListChecks className="w-7 h-7 text-slate-700" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Morning priority view
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      Start the day with a ranked view of what's overdue, what's at risk, and what can wait.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex gap-5">
                  <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <Layers className="w-7 h-7 text-slate-700" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      One source of truth
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      Lists work like spreadsheet tabs—without version confusion or duplicated files.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex gap-5">
                  <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <AlertTriangle className="w-7 h-7 text-slate-700" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Cost exposure visibility
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      See projected cost before charges hit the invoice.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex gap-5">
                  <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <ShieldCheck className="w-7 h-7 text-slate-700" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Team accountability
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      Every change is recorded with who did it and when.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex gap-5">
                  <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <Mail className="w-7 h-7 text-slate-700" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Client update workflow
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      Generate a draft update, review, approve, and send—consistent every time.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex gap-5">
                  <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <BarChart3 className="w-7 h-7 text-slate-700" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Operational insights
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      Spot bottlenecks by port and workload trends across your operation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* See it in action */}
      <section id="features" className="py-24 sm:py-32 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 mb-20 text-center">
              See it in action
            </h2>
            <div className="space-y-16">
              {/* Dashboard */}
              <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-12">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                      DASHBOARD
                    </p>
                    <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 mb-6">
                      Morning priorities
                    </h3>
                    <ul className="space-y-3">
                      <li className="text-slate-700">
                        Overdue = costing money now
                      </li>
                      <li className="text-slate-700">
                        At Risk = will become expensive soon
                      </li>
                      <li className="text-slate-700">
                        Today's activity = what changed since yesterday
                      </li>
                    </ul>
                  </div>
                  <div className="rounded-xl border border-slate-200 shadow-md overflow-hidden">
                    <Image
                      src="/images/dashboard.png"
                      alt="TerminalFlow dashboard"
                      width={1400}
                      height={900}
                      className="w-full h-auto"
                      sizes="(max-width: 1024px) 100vw, 50vw"
                    />
                  </div>
                </div>
              </div>

              {/* Container Control */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 sm:p-12">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                  <div className="lg:order-2 rounded-xl border border-slate-200 shadow-md overflow-hidden">
                    <Image
                      src="/images/containerspage.png"
                      alt="Container control room"
                      width={1400}
                      height={900}
                      className="w-full h-auto"
                      sizes="(max-width: 1024px) 100vw, 50vw"
                    />
                  </div>
                  <div className="lg:order-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                      CONTAINER CONTROL
                    </p>
                    <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 mb-6">
                      One source of truth
                    </h3>
                    <ul className="space-y-3">
                      <li className="text-slate-700">
                        Lists = client, lane, or team views
                      </li>
                      <li className="text-slate-700">
                        Search = find any container instantly
                      </li>
                      <li className="text-slate-700">
                        Status badges = Safe, Warning, or Overdue
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Analytics */}
              <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-12">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                      ANALYTICS
                    </p>
                    <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 mb-6">
                      Cost of inaction
                    </h3>
                    <ul className="space-y-3">
                      <li className="text-slate-700">
                        7-day projection = what you'll pay if nothing changes
                      </li>
                      <li className="text-slate-700">
                        Financial impact = prioritise by cost, not volume
                      </li>
                      <li className="text-slate-700">
                        Health breakdown = Safe / Warning / Overdue / Closed
                      </li>
                    </ul>
                  </div>
                  <div className="rounded-xl border border-slate-200 shadow-md overflow-hidden">
                    <Image
                      src="/images/analytics.png"
                      alt="Analytics overview"
                      width={1400}
                      height={900}
                      className="w-full h-auto"
                      sizes="(max-width: 1024px) 100vw, 50vw"
                    />
                  </div>
                </div>
              </div>

              {/* Port Performance */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 sm:p-12">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                  <div className="lg:order-2 rounded-xl border border-slate-200 shadow-md overflow-hidden">
                    <Image
                      src="/images/portperformance-analytics.png"
                      alt="Port performance analytics"
                      width={1400}
                      height={900}
                      className="w-full h-auto"
                      sizes="(max-width: 1024px) 100vw, 50vw"
                    />
                  </div>
                  <div className="lg:order-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                      ANALYTICS
                    </p>
                    <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 mb-6">
                      Port bottlenecks
                    </h3>
                    <ul className="space-y-3">
                      <li className="text-slate-700">
                        Port ranking = which ports have lowest average days left
                      </li>
                      <li className="text-slate-700">
                        Container count = volume per port
                      </li>
                      <li className="text-slate-700">
                        Pattern recognition = anticipate delays before they cost money
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Audit Trail */}
              <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-12">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                      AUDIT & HISTORY
                    </p>
                    <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 mb-6">
                      Accountability by default
                    </h3>
                    <ul className="space-y-3">
                      <li className="text-slate-700">
                        Change log = who changed what and when
                      </li>
                      <li className="text-slate-700">
                        Investigation = resolve discrepancies with proof
                      </li>
                      <li className="text-slate-700">
                        Team confidence = no "who changed this?" confusion
                      </li>
                    </ul>
                  </div>
                  <div className="rounded-xl border border-slate-200 shadow-md overflow-hidden">
                    <Image
                      src="/images/historylog.png"
                      alt="Activity log"
                      width={1400}
                      height={900}
                      className="w-full h-auto"
                      sizes="(max-width: 1024px) 100vw, 50vw"
                    />
                  </div>
                </div>
              </div>

              {/* Client Communication */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 sm:p-12">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                  <div className="lg:order-2 rounded-xl border border-slate-200 shadow-md overflow-hidden">
                    <Image
                      src="/images/dailyemaildigest.png"
                      alt="Client updates workflow"
                      width={1400}
                      height={900}
                      className="w-full h-auto"
                      sizes="(max-width: 1024px) 100vw, 50vw"
                    />
                  </div>
                  <div className="lg:order-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                      CLIENT COMMUNICATION
                    </p>
                    <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 mb-6">
                      Standardised updates
                    </h3>
                    <ul className="space-y-3">
                      <li className="text-slate-700">
                        Draft generation = system creates update from container data
                      </li>
                      <li className="text-slate-700">
                        Review & approve = no copy-paste from spreadsheets
                      </li>
                      <li className="text-slate-700">
                        Send history = record of what was communicated to each client
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What TerminalFlow Replaces */}
      <section className="py-24 sm:py-32 bg-slate-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 mb-16 text-center">
              What TerminalFlow replaces in daily operations
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <FileSpreadsheet className="w-10 h-10 text-slate-700" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">
                  Multiple spreadsheets
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  One shared system with persistent organisation.
                </p>
              </div>
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <MessageSquare className="w-10 h-10 text-slate-700" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">
                  Scattered email threads
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Standardised client updates with full history.
                </p>
              </div>
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Brain className="w-10 h-10 text-slate-700" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">
                  Manual prioritisation
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Automatic ranking by urgency and cost impact.
                </p>
              </div>
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <FileText className="w-10 h-10 text-slate-700" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">
                  Memory and guesswork
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Complete audit trail with attribution.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Reassurance Strip */}
      <section className="py-16 bg-white border-y border-slate-200">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-blue-50 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-[#2563EB]" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-2">
                  No heavy setup
                </h3>
                <p className="text-sm text-slate-600">
                  Import your existing spreadsheet and start immediately.
                </p>
              </div>
              <div>
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-blue-50 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-[#2563EB]" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-2">
                  Designed for ops teams
                </h3>
                <p className="text-sm text-slate-600">
                  Built for the daily workflow of freight forwarders.
                </p>
              </div>
              <div>
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-blue-50 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-[#2563EB]" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-2">
                  Immediate visibility
                </h3>
                <p className="text-sm text-slate-600">
                  See what matters from day one, no training required.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 sm:py-24 bg-[#2563EB] text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
              Ready to get out of spreadsheets?
            </h2>
            <p className="text-lg sm:text-xl mb-8 text-blue-100 leading-relaxed">
              Give your team a single live view of every container and stay ahead of demurrage fees.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/login">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  Get early access
                </Button>
              </Link>
              <a
                href="mailto:sales@terminalflow.app?subject=Talk to us"
                className="text-sm text-blue-100 hover:text-white underline"
              >
                Talk to us
              </a>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  )
}
