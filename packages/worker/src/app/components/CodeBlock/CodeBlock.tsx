import type { ReactNode } from 'react'
import clsx from 'clsx'

type CodeBlockProps = {
  className?: string
  children: ReactNode
}

export default function CodeBlock({ className, children }: CodeBlockProps) {
  return (
    <div
      className={clsx('border-edge-light overflow-x-auto rounded-lg border bg-[#111] px-4.5 py-3.5 font-mono text-[13px] leading-[1.7] text-[#ccc]', className)}>
      {children}
    </div>
  )
}
