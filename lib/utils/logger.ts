// /lib/utils/logger.ts

export const logger = {
  log: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') console.log(...args)
  },

  info: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') console.log('[INFO]', ...args)
  },

  debug: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') console.debug('[DEBUG]', ...args)
  },

  warn: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') console.warn('[WARN]', ...args)
  },

  error: (...args: any[]) => console.error('[ERROR]', ...args),

  time: (label?: string) => {
    if (process.env.NODE_ENV === 'development' && label) console.time(label)
  },

  timeEnd: (label?: string) => {
    if (process.env.NODE_ENV === 'development' && label) console.timeEnd(label)
  },
}
