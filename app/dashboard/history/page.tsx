import { ActivityLog } from '@/components/analytics/activity/ActivityLog'
import { Suspense } from 'react'

export default async function HistoryPage() {
  return (
    <main className="bg-[#F3F4F6] min-h-screen px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-[#111827]">History</h1>
              <p className="text-sm text-[#6B7280]">
                All container changes across your organization
              </p>
            </div>
          </div>
        </div>

        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <Suspense fallback={<div className="text-sm text-[#6B7280]">Loading activity…</div>}>
            <ActivityLog />
          </Suspense>
        </section>
      </div>
    </main>
  )
}

