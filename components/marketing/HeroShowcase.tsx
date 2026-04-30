'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Clock3, Mail, Ship, TrendingUp } from 'lucide-react'

const dockRows = [
  { port: 'SOU', status: 'Overdue', days: '-2d', tone: 'bg-red-50 text-red-700' },
  { port: 'FXT', status: 'At risk', days: '1d', tone: 'bg-amber-50 text-amber-700' },
  { port: 'LGP', status: 'Clear', days: '5d', tone: 'bg-emerald-50 text-emerald-700' },
]

export function HeroShowcase() {
  return (
    <div className="relative mx-auto max-w-xl lg:mx-0">
      <div className="absolute -inset-4 rounded-[2rem] bg-[radial-gradient(circle_at_35%_20%,rgba(14,165,233,0.24),transparent_34%),radial-gradient(circle_at_70%_80%,rgba(16,185,129,0.2),transparent_32%)]" />

      <motion.div
        className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        initial={false}
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-cyan-300">TerminalFlow Live</p>
              <p className="mt-1 text-lg font-semibold">Morning control room</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
              <Ship className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="grid gap-0 md:grid-cols-[0.92fr_1.08fr]">
          <div className="border-b border-slate-200 p-5 md:border-b-0 md:border-r">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-red-50 p-4">
                <AlertTriangle className="h-5 w-5 text-red-700" />
                <p className="mt-3 text-2xl font-semibold text-red-700">4</p>
                <p className="text-xs font-medium text-red-900">Overdue</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-4">
                <Clock3 className="h-5 w-5 text-amber-700" />
                <p className="mt-3 text-2xl font-semibold text-amber-700">8</p>
                <p className="text-xs font-medium text-amber-900">At risk</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-4">
                <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                <p className="mt-3 text-2xl font-semibold text-emerald-700">31</p>
                <p className="text-xs font-medium text-emerald-900">Safe</p>
              </div>
              <div className="rounded-xl bg-cyan-50 p-4">
                <TrendingUp className="h-5 w-5 text-cyan-700" />
                <p className="mt-3 text-2xl font-semibold text-cyan-700">7d</p>
                <p className="text-xs font-medium text-cyan-900">Projection</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-cyan-700 shadow-sm">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-950">Client update ready</p>
                  <p className="text-xs text-slate-600">Drafted from live milestones</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5">
            <p className="text-xs font-semibold uppercase text-slate-500">Priority lanes</p>
            <div className="mt-4 space-y-3">
              {dockRows.map((row, index) => (
                <motion.div
                  key={row.port}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                  initial={false}
                  animate={{ x: [0, index === 1 ? 5 : 0, 0] }}
                  transition={{ duration: 4.2, delay: index * 0.3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-sm font-semibold text-white">
                      {row.port}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{row.status}</p>
                      <p className="text-xs text-slate-500">Import containers</p>
                    </div>
                  </div>
                  <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${row.tone}`}>{row.days}</span>
                </motion.div>
              ))}
            </div>

            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
              <Image
                src="/images/dashboard.png"
                alt="TerminalFlow dashboard preview"
                width={900}
                height={580}
                className="h-auto w-full"
                sizes="(max-width: 1024px) 90vw, 27vw"
                priority
              />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
