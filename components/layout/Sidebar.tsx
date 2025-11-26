'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo } from 'react'

import { APP_NAV_ITEMS, getActiveNavItem, type AppNavItem } from '@/lib/constants/nav'
import { isActiveRoute, normalizePath } from '@/lib/utils/navigation'
import { cn } from '@/lib/utils'
import { PortflowLogo } from '@/components/ui/PortflowLogo'

export function Sidebar() {
  const pathname = usePathname()
  const normalizedPathname = useMemo(() => normalizePath(pathname ?? '/'), [pathname])
  const activeItem = useMemo(() => getActiveNavItem(normalizedPathname), [normalizedPathname])

  return (
    <aside className="flex w-64 flex-col border-r border-[#D1D5DB] bg-[#E5E7EB] flex-shrink-0">
      <div className="border-b border-[#D1D5DB] px-6 py-5">
        <PortflowLogo size="sm" />
        <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-[#6B7280]">
          Operations Console
        </p>
      </div>

      <nav className="flex-1 space-y-1 py-3">
        {APP_NAV_ITEMS.map((item) => {
          const normalizedHref = normalizePath(item.href)
          const isActive =
            isActiveRoute(normalizedPathname, normalizedHref) ||
            activeItem?.href === normalizedHref
          const navItem = item as AppNavItem
          const Icon = navItem.icon

          return (
            <div key={item.href} className="px-3">
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md border-l-[3px] px-3 py-2.5 text-sm font-medium tracking-tight transition-colors duration-100',
                  isActive
                    ? 'border-[#2563EB] bg-[#ECF2FD] text-[#1F2937]'
                    : 'border-transparent text-[#4B5563] hover:bg-[#E1E5EA] hover:text-[#1F2937]'
                )}
              >
                {Icon ? <Icon className="h-4 w-4" /> : null}
                {item.label}
              </Link>

              {navItem.children?.length ? (
                <div className="mt-1 space-y-1 pl-9">
                  {navItem.children.map((child: AppNavItem) => {
                    const normalizedChildHref = normalizePath(child.href)
                    const childActive =
                      isActiveRoute(normalizedPathname, normalizedChildHref) ||
                      activeItem?.href === normalizedChildHref

                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          'block rounded-md px-2 py-1 text-sm transition-colors duration-100',
                          childActive
                            ? 'bg-[#DCE9FE] text-[#1E40AF]'
                            : 'text-[#6B7280] hover:bg-[#E1E5EA] hover:text-[#1F2937]'
                        )}
                      >
                        {child.label}
                      </Link>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
