import clsx from 'clsx'

export default function NeonCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={clsx(
        'relative border border-[#00FF8833] bg-gradient-to-br from-[#0a0f1a] to-[#030712]',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-[-1px] rounded-[inherit] p-px"
        style={{
          background: 'linear-gradient(135deg, #00FF8855, #00D4FF33, #FF008022)',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />
      {children}
    </div>
  )
}
