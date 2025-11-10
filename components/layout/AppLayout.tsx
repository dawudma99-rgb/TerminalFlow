'use client'

import { ReactNode, memo } from 'react'
import dynamic from 'next/dynamic'
import { Sidebar } from './Sidebar'

// Load Topbar dynamically on client only to prevent hydration mismatches
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
      <div className="flex">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Topbar />
          <main className="flex-1 px-6 py-4 lg:px-8 lg:py-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
})
