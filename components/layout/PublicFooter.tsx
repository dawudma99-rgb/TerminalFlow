import { PortflowLogo } from '@/components/ui/PortflowLogo'
import Link from 'next/link'

export function PublicFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t bg-white py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <PortflowLogo size="sm" />
          <div className="flex items-center gap-6">
            <Link href="#" className="text-sm text-gray-600 hover:text-gray-900">
              Privacy
            </Link>
            <Link href="#" className="text-sm text-gray-600 hover:text-gray-900">
              Terms
            </Link>
            <p className="text-sm text-gray-600">
              © {currentYear} TerminalFlow. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
