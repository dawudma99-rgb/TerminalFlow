'use client'

import { ReactNode, memo } from 'react'
import dynamic from 'next/dynamic'
import { LoaderBar } from '@/components/ui/LoaderBar'

// Load Sidebar and Topbar dynamically on client only to prevent hydration mismatches
// Sidebar uses usePathname() which requires router context, so it must be client-only
const Sidebar = dynamic(() => import('./Sidebar').then(mod => ({ default: mod.Sidebar })), {
  ssr: false,
})

const Topbar = dynamic(() => import('./Topbar').then(mod => ({ default: mod.Topbar })), {
  ssr: false,
})

interface AppLayoutProps {
  children: ReactNode
}

// Memoized to prevent unnecessary re-renders that cascade to Topbar
export const AppLayout = memo(function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-[#F6F7F9] text-slate-800">
      <LoaderBar />
      <div className="flex">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Topbar />
          <main className="flex-1 px-6 py-4 lg:px-8 lg:py-6 animate-fade-in">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
})
