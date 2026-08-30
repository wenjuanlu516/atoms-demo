import { type ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

type Variant = 'primary' | 'ghost' | 'outline' | 'danger'

const styles: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-soft',
  ghost: 'bg-transparent text-fog hover:bg-raised hover:text-snow',
  outline: 'border border-line bg-transparent text-fog hover:border-line-strong hover:text-snow',
  danger: 'bg-rose/15 text-rose hover:bg-rose/25',
}

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        styles[variant],
        className,
      )}
      {...props}
    />
  )
}
