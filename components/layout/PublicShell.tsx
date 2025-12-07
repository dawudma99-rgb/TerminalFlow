import { ReactNode } from 'react'
import { PublicHeader } from './PublicHeader'
import { PublicFooter } from './PublicFooter'

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PublicHeader />
      <main className="flex-1">
        {children}
      </main>
      <PublicFooter />
    </div>
  )
}
