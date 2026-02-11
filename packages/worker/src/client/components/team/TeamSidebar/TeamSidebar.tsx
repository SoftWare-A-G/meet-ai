import type { TeamInfo, TeamMember } from '../../../lib/types'
import { ensureSenderContrast } from '../../../lib/colors'

type TeamSidebarProps = {
  teamInfo: TeamInfo
  isOpen: boolean
  onClose: () => void
}

function MemberRow({ member, inactive }: { member: TeamMember; inactive?: boolean }) {
  return (
    <div class={`team-member${inactive ? ' team-member--inactive' : ''}`}>
      <span
        class="team-member-dot"
        style={{ background: inactive ? '#555' : ensureSenderContrast(member.color) }}
      />
      <span class="team-member-name">{member.name}</span>
      <span class="team-member-model">{member.model}</span>
    </div>
  )
}

export default function TeamSidebar({ teamInfo, isOpen, onClose }: TeamSidebarProps) {
  const active = teamInfo.members.filter(m => m.status === 'active')
  const inactive = teamInfo.members.filter(m => m.status === 'inactive')

  return (
    <div class={`team-sidebar${isOpen ? ' open' : ''}`}>
      <div class="team-sidebar-header">
        <span>Team</span>
        <span class="team-sidebar-count">{active.length}/{teamInfo.members.length}</span>
        <button class="team-sidebar-close-btn" onClick={onClose}>&times;</button>
      </div>
      {active.length > 0 && (
        <div class="team-section">
          <div class="team-section-label">Active</div>
          {active.map(m => <MemberRow key={m.name} member={m} />)}
        </div>
      )}
      {inactive.length > 0 && (
        <div class="team-section">
          <div class="team-section-label">Inactive</div>
          {inactive.map(m => <MemberRow key={m.name} member={m} inactive />)}
        </div>
      )}
    </div>
  )
}
