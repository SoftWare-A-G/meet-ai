import type { ReactNode } from 'react'

type CodeBlockProps = {
  className?: string
  children: ReactNode
}

export default function CodeBlock({ className, children }: CodeBlockProps) {
  return (
    <div
      className={`border-edge-light overflow-x-auto rounded-lg border bg-[#111] px-4.5 py-3.5 font-mono text-[13px] leading-[1.7] text-[#ccc]${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  )
}
