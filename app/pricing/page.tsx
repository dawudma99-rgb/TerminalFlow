import { PublicShell } from '@/components/layout/PublicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export default function PricingPage() {
  return (
    <PublicShell>
      {/* Intro Section */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900">
              Simple pricing that pays for itself
            </h1>
            <p className="text-xl text-gray-600">
              TerminalFlow is built for small & mid-sized freight forwarders who want to get out of spreadsheets and stay ahead of demurrage.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Plans */}
      <section className="py-12 pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Early Access Plan */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Early Access</CardTitle>
                <CardDescription className="text-lg mt-2">
                  <span className="text-3xl font-bold text-gray-900">Let's talk</span>
                </CardDescription>
                <CardDescription className="mt-4">
                  Ideal for teams who want to try TerminalFlow with real containers and give product feedback.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <span className="text-[#2563EB] mt-1">✓</span>
                    <span className="text-gray-700">Up to 5 users</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#2563EB] mt-1">✓</span>
                    <span className="text-gray-700">Unlimited containers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#2563EB] mt-1">✓</span>
                    <span className="text-gray-700">Alerts & risk statuses (Safe / Warning / Overdue)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#2563EB] mt-1">✓</span>
                    <span className="text-gray-700">CSV/Excel import</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#2563EB] mt-1">✓</span>
                    <span className="text-gray-700">Email digests</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#2563EB] mt-1">✓</span>
                    <span className="text-gray-700">Priority onboarding support</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Link href="/login" className="w-full">
                  <Button className="w-full" size="lg">
                    Get early access
                  </Button>
                </Link>
              </CardFooter>
            </Card>

            {/* Team Plan */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Team</CardTitle>
                <CardDescription className="text-lg mt-2">
                  <span className="text-3xl font-bold text-gray-900">Custom</span>
                </CardDescription>
                <CardDescription className="mt-4">
                  For forwarding teams that need multiple lists, users, and higher usage.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <span className="text-[#2563EB] mt-1">✓</span>
                    <span className="text-gray-700">Everything in Early Access</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#2563EB] mt-1">✓</span>
                    <span className="text-gray-700">More users</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#2563EB] mt-1">✓</span>
                    <span className="text-gray-700">Dedicated onboarding call</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#2563EB] mt-1">✓</span>
                    <span className="text-gray-700">Help migrating from existing spreadsheets</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <a
                  href="mailto:sales@terminalflow.app?subject=TerminalFlow%20Team%20Plan"
                  className="w-full"
                >
                  <Button variant="outline" className="w-full" size="lg">
                    Talk to us
                  </Button>
                </a>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      {/* Bottom CTA Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl font-bold text-gray-900">
              Not sure which plan is right for you?
            </h2>
            <p className="text-lg text-gray-600">
              We're here to help. Book a quick call to discuss your team's needs and see how TerminalFlow can fit into your workflow.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="mailto:sales@terminalflow.app?subject=TerminalFlow%20Inquiry"
                className="inline-block"
              >
                <Button size="lg" variant="outline">
                  Book a call
                </Button>
              </a>
              <Link href="/login">
                <Button size="lg">
                  Get started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  )
}
