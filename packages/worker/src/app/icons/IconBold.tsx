export function IconBold({ size = 24, ...props }: { size?: number } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 5h6a3.5 3.5 0 0 1 0 7h-6l0 -7" />
      <path d="M13 12h1a3.5 3.5 0 0 1 0 7h-7v-7" />
    </svg>
  )
}
