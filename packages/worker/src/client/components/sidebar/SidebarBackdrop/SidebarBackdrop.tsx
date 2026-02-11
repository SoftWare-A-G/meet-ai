interface SidebarBackdropProps {
  onClick: () => void
}

export default function SidebarBackdrop({ onClick }: SidebarBackdropProps) {
  return <div class="sidebar-backdrop" onClick={onClick} style="display:block" />
}
