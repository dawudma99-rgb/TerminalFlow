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
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Topbar />
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
})
