'use client'

import { motion, useReducedMotion, type MotionProps } from 'framer-motion'
import { type ReactNode } from 'react'

type ScrollRevealProps = {
  children: ReactNode
  className?: string
  delay?: number
  direction?: 'up' | 'down' | 'left' | 'right'
  duration?: number
} & Pick<MotionProps, 'viewport'>

const offsets = {
  up: { y: 36, x: 0 },
  down: { y: -28, x: 0 },
  left: { x: 36, y: 0 },
  right: { x: -36, y: 0 },
}

export function ScrollReveal({
  children,
  className,
  delay = 0,
  direction = 'up',
  duration = 0.55,
  viewport = { once: true, amount: 0.2 },
}: ScrollRevealProps) {
  const offset = offsets[direction]
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={false}
      whileInView={reduceMotion ? undefined : { opacity: [1, 1], x: [offset.x, 0], y: [offset.y, 0] }}
      viewport={viewport}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
