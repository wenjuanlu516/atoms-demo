import { type InputHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm text-snow outline-none placeholder:text-mist focus:border-accent',
        className,
      )}
      {...props}
    />
  )
}
