import { PortflowLogo } from '@/components/ui/PortflowLogo'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" aria-label="TerminalFlow home" className="shrink-0">
            <PortflowLogo size="md" />
          </Link>
          <nav className="flex items-center gap-3 sm:gap-6">
            <Link href="/#features" className="hidden text-sm font-medium text-slate-600 hover:text-slate-950 sm:inline">
              Features
            </Link>
            <Link href="/pricing" className="hidden text-sm font-medium text-slate-600 hover:text-slate-950 sm:inline">
              Pricing
            </Link>
            <Button asChild variant="outline" size="sm" className="rounded-lg">
              <Link href="/login">
                Login
              </Link>
            </Button>
            <Button asChild size="sm" className="rounded-lg">
              <Link href="/login">
                Get access
              </Link>
            </Button>
          </nav>
        </div>
      </div>
    </header>
  )
}
