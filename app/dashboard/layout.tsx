'use client'

import { ReactNode } from "react"
import { AppLayout } from "@/components/layout/AppLayout"
import { ListsProvider } from "@/components/providers/ListsProvider"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ListsProvider>
      <AppLayout>{children}</AppLayout>
    </ListsProvider>
  )
}

