import { jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

import { Sidebar } from '@/components/layout/Sidebar'
import * as nextNavigation from 'next/navigation'

describe('Sidebar navigation active states', () => {
  const mockUsePathname = (path: string) => {
    jest.spyOn(nextNavigation, 'usePathname').mockReturnValue(path)
  }

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('highlights Dashboard only for /dashboard', () => {
    mockUsePathname('/dashboard')
    render(<Sidebar />)

    const dashboard = screen.getByText('Dashboard')
    expect(dashboard).toHaveClass('bg-[#ECF2FD]')
    expect(screen.getByText('Containers')).not.toHaveClass('bg-[#ECF2FD]')
  })

  test('highlights Containers only for /dashboard/containers', () => {
    mockUsePathname('/dashboard/containers')
    render(<Sidebar />)

    const containers = screen.getByText('Containers')
    expect(containers).toHaveClass('bg-[#ECF2FD]')
    expect(screen.getByText('Dashboard')).not.toHaveClass('bg-[#ECF2FD]')
  })

  test('highlights Analytics and Reports for /dashboard/analytics/reports', () => {
    mockUsePathname('/dashboard/analytics/reports')
    render(<Sidebar />)

    const analytics = screen.getByText('Analytics')
    const reports = screen.getByText('Reports')

    expect(analytics).toHaveClass('bg-[#ECF2FD]')
    expect(reports).toHaveClass('bg-[#DCE9FE]')
  })

  test('highlights Settings only for /dashboard/settings', () => {
    mockUsePathname('/dashboard/settings')
    render(<Sidebar />)

    const settings = screen.getByText('Settings')
    expect(settings).toHaveClass('bg-[#ECF2FD]')
  })

  test('renders no active state for unknown route', () => {
    mockUsePathname('/unknown')
    render(<Sidebar />)

    expect(document.querySelectorAll('.bg-[#ECF2FD]').length).toBe(0)
    expect(document.querySelectorAll('.bg-[#DCE9FE]').length).toBe(0)
  })
})

