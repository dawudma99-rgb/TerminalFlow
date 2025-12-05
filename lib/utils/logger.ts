// /lib/utils/logger.ts

import * as Sentry from "@sentry/nextjs";

type LoggerLevel = 'log' | 'info' | 'debug' | 'warn' | 'error'

export type LoggerPayload = {
  message: string
  context?: Record<string, unknown>
  level?: Exclude<LoggerLevel, 'log'>
}

type LoggerInput = LoggerPayload | string

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeContext(
  base: Record<string, unknown> | undefined,
  extra: unknown
): Record<string, unknown> | undefined {
  if (!extra) return base
  const normalized = isRecord(extra) ? extra : { data: extra }
  return base ? { ...base, ...normalized } : normalized
}

function normalizePayload(
  level: LoggerLevel,
  input: LoggerInput,
  context?: unknown
): LoggerPayload {
  if (typeof input === 'string') {
    return {
      message: input,
      context: mergeContext(undefined, context),
      level: level === 'log' ? undefined : level,
    }
  }

  return {
    message: input.message,
    level: input.level ?? (level === 'log' ? undefined : level),
    context: mergeContext(input.context, context),
  }
}

function emit(level: LoggerLevel, input: LoggerInput, context?: unknown) {
  const payload = normalizePayload(level, input, context)
  const effectiveLevel = payload.level ?? level
  const parts: unknown[] = []

  if (effectiveLevel !== 'log') {
    parts.push(`[${effectiveLevel.toUpperCase()}]`)
  }

  parts.push(payload.message)
  if (payload.context) {
    parts.push(payload.context)
  }

  const shouldLog = effectiveLevel === 'error' || process.env.NODE_ENV === 'development'

  if (!shouldLog) return

  const consoleMethod =
    effectiveLevel === 'error'
      ? console.error
      : effectiveLevel === 'warn'
        ? console.warn
        : effectiveLevel === 'debug'
          ? console.debug
          : console.log

  consoleMethod(...parts)

  // Capture error-level logs to Sentry
  if (effectiveLevel === 'error') {
    let errorToCapture: Error | null = null
    const extraContext: Record<string, unknown> = {}
    
    // First, check if context itself is an Error
    if (context instanceof Error) {
      errorToCapture = context
    } else {
      // Check payload.context (merged/normalized context)
      const contextObj = payload.context
      
      if (contextObj instanceof Error) {
        errorToCapture = contextObj
      } else if (contextObj && typeof contextObj === 'object') {
        const contextRecord = contextObj as Record<string, unknown>
        
        // Check for common error property names
        if (contextRecord.error instanceof Error) {
          errorToCapture = contextRecord.error
        } else if (contextRecord.err instanceof Error) {
          errorToCapture = contextRecord.err
        } else if (contextRecord.reason instanceof Error) {
          errorToCapture = contextRecord.reason
        }
        
        // Collect extra context (excluding the error itself)
        Object.keys(contextRecord).forEach(key => {
          const value = contextRecord[key]
          if (value !== errorToCapture && !(value instanceof Error)) {
            extraContext[key] = value
          }
        })
      }
      
      // Check parts array for Error objects (from console logging)
      for (const part of parts) {
        if (part instanceof Error) {
          errorToCapture = part
          break
        }
      }
    }

    // If no Error object found, create one from the message
    if (!errorToCapture) {
      errorToCapture = payload.message 
        ? new Error(payload.message)
        : new Error('Logger captured error with no message')
    }

    Sentry.captureException(errorToCapture, {
      tags: { loggerLevel: 'error' },
      extra: Object.keys(extraContext).length > 0 ? extraContext : undefined,
    })
  }
}

function createLoggerMethod(level: LoggerLevel) {
  return (input: LoggerInput, ...contexts: Array<Record<string, unknown> | unknown>) => {
    const mergedContext = contexts.reduce<Record<string, unknown> | undefined>(
      (acc, current) => mergeContext(acc, current),
      undefined
    )
    emit(level, input, mergedContext)
  }
}

export const logger = {
  log: createLoggerMethod('log'),
  info: createLoggerMethod('info'),
  debug: createLoggerMethod('debug'),
  warn: createLoggerMethod('warn'),
  error: createLoggerMethod('error'),
  time: (label?: string) => {
    if (process.env.NODE_ENV === 'development' && label) console.time(label)
  },
  timeEnd: (label?: string) => {
    if (process.env.NODE_ENV === 'development' && label) console.timeEnd(label)
  },
}
