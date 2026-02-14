interface SidebarBackdropProps {
  onClick: () => void
}

export default function SidebarBackdrop({ onClick }: SidebarBackdropProps) {
  return <div className="fixed inset-0 bg-black/50 z-[49] [-webkit-tap-highlight-color:transparent]" onClick={onClick} />
}
