import clsx from 'clsx'

export default function TerminalBlock({
  header,
  children,
  className,
}: {
  header?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={clsx(
        'overflow-hidden rounded-lg border border-[#00FF8833] bg-[#0a0f1aee] font-mono text-sm',
        className,
      )}
    >
      <div
        className={clsx(
          'flex items-center gap-1.5 border-b border-[#00FF8822] bg-[#0a0f1a] px-3.5 py-2.5',
          header && 'justify-between',
        )}
      >
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[#FF5F57]" />
          <span className="size-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="size-2.5 rounded-full bg-[#28C840]" />
        </div>
        {header}
      </div>
      <div className="p-3.5 leading-[1.7] text-[#00FF88]">{children}</div>
    </div>
  )
}
