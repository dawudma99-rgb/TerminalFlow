'use client'

import { motion } from 'framer-motion'
import { BrainCircuit, RadioTower, Ship, Waves } from 'lucide-react'

const ports = [
  { code: 'FXT', name: 'Felixstowe', status: 'Dwell rising', x: '18%', y: '34%', tone: 'border-amber-300/60 bg-amber-300/12 text-amber-100' },
  { code: 'SOU', name: 'Southampton', status: 'Congestion alert', x: '66%', y: '26%', tone: 'border-red-300/60 bg-red-300/12 text-red-100' },
  { code: 'LGP', name: 'London Gateway', status: 'Flow stable', x: '74%', y: '68%', tone: 'border-emerald-300/60 bg-emerald-300/12 text-emerald-100' },
]

export function AiPortMonitor() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950 p-6 text-white shadow-2xl sm:p-8">
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(34,211,238,0.16),transparent_36%,rgba(16,185,129,0.12))]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:38px_38px] opacity-50" />

      <div className="relative grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5 text-sm font-semibold text-cyan-100">
            <BrainCircuit className="h-4 w-4" />
            AI port intelligence
          </div>
          <h2 className="text-3xl font-semibold tracking-[-0.01em] sm:text-5xl">
            Port performance is monitored by AI.
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
            TerminalFlow watches dwell time, congestion movement, and delay patterns across ports so risk is visible before it lands on the invoice.
          </p>
        </div>

        <div className="relative min-h-[360px] overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
          <motion.div
            className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/30"
            animate={{ scale: [0.9, 1.12, 0.9], opacity: [0.3, 0.75, 0.3] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300/25"
            animate={{ scale: [1.08, 0.9, 1.08], opacity: [0.65, 0.28, 0.65] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute left-1/2 top-1/2 h-[2px] w-[42%] origin-left bg-gradient-to-r from-cyan-300 via-cyan-300/60 to-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 5.8, repeat: Infinity, ease: 'linear' }}
          />

          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 360" aria-hidden="true">
            <motion.path
              d="M108 122 C210 52, 340 48, 418 96 S500 228, 444 244"
              fill="none"
              stroke="rgba(34,211,238,0.55)"
              strokeWidth="2"
              strokeDasharray="8 10"
              animate={{ strokeDashoffset: [0, -90] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'linear' }}
            />
            <motion.path
              d="M116 124 C172 210, 270 282, 444 244"
              fill="none"
              stroke="rgba(16,185,129,0.45)"
              strokeWidth="2"
              strokeDasharray="7 11"
              animate={{ strokeDashoffset: [0, -84] }}
              transition={{ duration: 5.2, repeat: Infinity, ease: 'linear' }}
            />
          </svg>

          <div className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-cyan-300/35 bg-slate-950/90 shadow-[0_0_45px_rgba(34,211,238,0.28)]">
            <BrainCircuit className="h-9 w-9 text-cyan-200" />
          </div>

          {ports.map((port, index) => (
            <motion.div
              key={port.code}
              className={`absolute w-44 rounded-xl border p-3 backdrop-blur ${port.tone}`}
              style={{ left: port.x, top: port.y }}
              animate={{ y: [0, index === 1 ? -8 : 8, 0] }}
              transition={{ duration: 3 + index * 0.35, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{port.code}</p>
                  <p className="mt-0.5 text-xs text-white/60">{port.name}</p>
                </div>
                <RadioTower className="h-4 w-4" />
              </div>
              <p className="mt-3 text-xs font-semibold">{port.status}</p>
            </motion.div>
          ))}

          <motion.div
            className="absolute bottom-5 left-5 flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-200 backdrop-blur"
            animate={{ opacity: [0.65, 1, 0.65] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Ship className="h-4 w-4 text-cyan-200" />
            47 containers under watch
          </motion.div>
          <div className="absolute bottom-5 right-5 flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-200 backdrop-blur">
            <Waves className="h-4 w-4 text-emerald-200" />
            Live port signals
          </div>
        </div>
      </div>
    </div>
  )
}
