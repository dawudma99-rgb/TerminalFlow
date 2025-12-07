import { PortflowLogo } from '@/components/ui/PortflowLogo'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function PublicHeader() {
  return (
    <header className="border-b bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <PortflowLogo size="md" />
          <nav className="flex items-center gap-6">
            <a href="#features" className="text-sm font-medium text-gray-700 hover:text-gray-900">
              Features
            </a>
            <Link href="/pricing" className="text-sm font-medium text-gray-700 hover:text-gray-900">
              Pricing
            </Link>
            <Link href="/login">
              <Button variant="outline" size="sm">
                Login
              </Button>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}
