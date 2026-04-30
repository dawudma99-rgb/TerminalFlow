import { PortflowLogo } from '@/components/ui/PortflowLogo'
import Link from 'next/link'

export function PublicFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-slate-200 bg-slate-50 py-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-5 sm:flex-row">
          <PortflowLogo size="sm" />
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <Link href="#" className="text-sm text-slate-600 hover:text-slate-950">
              Privacy
            </Link>
            <Link href="#" className="text-sm text-slate-600 hover:text-slate-950">
              Terms
            </Link>
            <p className="text-sm text-slate-600">
              Copyright {currentYear} TerminalFlow. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
