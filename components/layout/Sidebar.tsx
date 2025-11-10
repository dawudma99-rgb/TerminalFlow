'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Container,
  BarChart3,
  Settings,
  User,
} from 'lucide-react'

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Containers',
    href: '/dashboard/containers',
    icon: Container,
  },
  {
    name: 'Analytics',
    href: '/dashboard/analytics',
    icon: BarChart3,
  },
  {
    name: 'Profile',
    href: '/dashboard/profile',
    icon: User,
  },
  {
    name: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-[#E5E7EB] border-r border-[#D1D5DB] flex flex-col">
      <div className="px-6 py-5 border-b border-[#D1D5DB]">
        <h1 className="text-base font-semibold text-[#1F2937] tracking-tight">D&D Copilot</h1>
        <p className="text-[11px] text-[#6B7280] mt-1 uppercase tracking-[0.22em]">Operations Console</p>
      </div>

      <nav className="flex-1 py-3 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          const Icon = item.icon

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-6 py-2.5 text-sm font-medium rounded-md border-l-[3px] transition-colors duration-100 tracking-tight',
                isActive
                  ? 'bg-[#ECF2FD] border-[#2563EB] text-[#1F2937]'
                  : 'border-transparent text-[#4B5563] hover:bg-[#E1E5EA] hover:text-[#1F2937]'
              )}
            >
              <Icon className="w-4 h-4" />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
