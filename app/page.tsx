import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PublicShell } from '@/components/layout/PublicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'

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
      <section className="py-20 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
              Stop losing money to demurrage.
            </h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              TerminalFlow gives small & mid-sized freight forwarders a live control tower for every import container — so you can see what's safe, what's at risk, and what's already overdue.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/login">
                <Button size="lg" className="w-full sm:w-auto">
                  Get early access
                </Button>
              </Link>
              <a
                href="mailto:sales@terminalflow.app?subject=Book a 15-minute walkthrough"
                className="text-sm text-gray-600 hover:text-gray-900 underline"
              >
                Book a 15-minute walkthrough
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Why spreadsheets and email aren't enough anymore
            </h2>
          </div>
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No single source of truth
                </h3>
                <p className="text-gray-600">
                  Container information is split across Excel sheets, email threads, and WhatsApp chats.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Demurrage surprises
                </h3>
                <p className="text-gray-600">
                  You only find out a box went into demurrage when the invoice lands.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Slow client updates
                </h3>
                <p className="text-gray-600">
                  Every "where's my container?" email means hunting through multiple tools.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No shared visibility
                </h3>
                <p className="text-gray-600">
                  Different people have different versions of the truth.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              How TerminalFlow fits into your day
            </h2>
          </div>
          <div className="max-w-4xl mx-auto space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Import your containers
                    </h3>
                    <p className="text-gray-600">
                      Upload your existing spreadsheet or start from scratch in minutes.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      See every box in one dashboard
                    </h3>
                    <p className="text-gray-600">
                      View all containers by client, lane, or team with live status.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Get ahead of demurrage
                    </h3>
                    <p className="text-gray-600">
                      Free time logic shows what's Safe, what's in Warning, and what's Overdue.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold">
                    4
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Send clean, consistent updates to clients
                    </h3>
                    <p className="text-gray-600">
                      Generate ready-to-send email updates and digests in a few clicks.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Everything your team needs in one place
            </h2>
          </div>
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Live container control tower
                </h3>
                <p className="text-gray-600">
                  One shared view of every import container and its status.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Demurrage prevention engine
                </h3>
                <p className="text-gray-600">
                  Free time tracking with Safe / Warning / Overdue states.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Team-ready lists & history
                </h3>
                <p className="text-gray-600">
                  Organise containers into lists and track every change.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Client communication built in
                </h3>
                <p className="text-gray-600">
                  Generate and approve update emails before sending.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ROI Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
              Prevent just one demurrage incident and TerminalFlow pays for itself
            </h2>
            <div className="space-y-4 text-lg text-gray-600">
              <p>
                A single overdue container can cost <strong className="text-gray-900">£200–£400 per day</strong> in demurrage.
              </p>
              <p>
                TerminalFlow helps you spot at-risk containers days before free time expires, and keeps a record of what you told your clients.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 bg-[#2563EB] text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Ready to get out of spreadsheets?
            </h2>
            <p className="text-xl mb-8 text-blue-100">
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
