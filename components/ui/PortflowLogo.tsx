import { cn } from '@/lib/utils'

interface PortflowLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function PortflowLogo({ className, size = 'md' }: PortflowLogoProps) {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  }

  return (
    <div className={cn('inline-flex items-center', className)}>
      <span
        className={cn(
          'font-extrabold text-[#1E3A8A]',
          'select-none',
          'tracking-tight',
          sizeClasses[size]
        )}
        style={{
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          letterSpacing: '-0.04em',
          fontWeight: 800,
        }}
      >
        Terminal<span className="text-[#2563EB]">Flow</span>
      </span>
    </div>
  )
}

