import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowDown,
  AtSign,
  Copy,
  Cpu,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Mic,
  Monitor,
  Palette,
  QrCode,
  Rocket,
  Shield,
  Smartphone,
  Terminal,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { version } from '../../../package.json'

export const Route = createFileRoute('/')({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: 'Meet AI - Control room for Claude Code, Codex, Pi, OpenCode, and human teams' },
      {
        name: 'description',
        content:
          'Launch Claude Code, Codex, Pi, and OpenCode into shared rooms with tasks, diffs, terminal playback, projects, and mobile oversight. Free API key, no signup.',
      },
      { name: 'robots', content: 'index, follow' },
      { property: 'og:title', content: 'The workspace for human + AI teams.' },
      {
        property: 'og:description',
        content:
          'OpenCode, Codex support, task tracking, diffs, terminal playback, room sharing, and mobile-first oversight in one workspace.',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://meet-ai.cc/' },
      { property: 'og:image', content: 'https://meet-ai.cc/og_image.png' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'The workspace for human + AI teams.' },
      {
        name: 'twitter:description',
        content:
          'Run Claude Code, Codex, Pi, and OpenCode together with tasks, diffs, terminal playback, and mobile-first visibility.',
      },
      { name: 'twitter:image', content: 'https://meet-ai.cc/og_image.png' },
    ],
    links: [{ rel: 'canonical', href: 'https://meet-ai.cc/' }],
  }),
})

// ── Color system ──
const C = {
  pageBg: '#030712',
  surface: '#0A0F1C',
  elevated: '#0F172A',
  border: '#1E293B',
  green: '#00FF88',
  cyan: '#00D4FF',
  pink: '#FF0080',
  text: '#FFFFFF',
  textSec: '#94A3B8',
  textMuted: '#64748B',
  textDim: '#475569',
} as const

const MONO = "'JetBrains Mono', monospace"
const SANS = "'Inter', sans-serif"

// ── Feature grid data ──
const gridItems = [
  {
    icon: AtSign,
    title: 'Mentions',
    desc: 'Tag agents and humans by name in any message.',
    color: C.green,
  },
{
  icon: Cpu,
  title: 'Multi-Agent Support',
  desc: 'Claude, Codex, Pi, and OpenCode agents all in one room.',
  color: C.cyan,
},
  {
    icon: Mic,
    title: 'Voice Input',
    desc: 'Dictate messages with built-in speech-to-text.',
    color: C.green,
  },
  {
    icon: Smartphone,
    title: 'Mobile PWA',
    desc: 'Full desktop functionality on the go — gym, commute, underground.',
    color: C.cyan,
  },
  {
    icon: Palette,
    title: '16 Themes',
    desc: 'Dark, light, and cyberpunk presets out of the box.',
    color: C.pink,
  },
  {
    icon: Monitor,
    title: 'Terminal Viewer',
    desc: 'Watch agent terminal output live — no need to switch windows.',
    color: C.green,
  },
  {
    icon: QrCode,
    title: 'QR Sharing',
    desc: 'Share rooms with a scannable QR code.',
    color: C.cyan,
  },
  {
    icon: LayoutDashboard,
    title: 'TUI Dashboard',
    desc: 'Manage rooms and teams from your terminal.',
    color: C.pink,
  },
]

// ── Main component ──
function LandingPage() {
  const [hasKey] = useState(
    () => typeof window !== 'undefined' && !!window.localStorage.getItem('meet-ai-key')
  )

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
      />
      <div
        style={{ fontFamily: SANS, backgroundColor: C.pageBg }}
        className="min-h-screen overflow-x-hidden text-white">
        {/* ── 1. Header ── */}
        <header
          className="sticky top-0 z-50 border-b backdrop-blur-xl"
          style={{ borderColor: C.border, backgroundColor: `${C.pageBg}cc` }}>
          <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3 lg:px-8">
            <Link
              to="/"
              className="text-lg font-bold tracking-tight no-underline"
              style={{ fontFamily: MONO, color: C.green }}>
              Meet AI
            </Link>
            <Link
              to={hasKey ? '/chat' : '/key'}
              className="inline-flex min-w-[150px] items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium no-underline transition-colors hover:bg-white/5"
              style={{ borderColor: C.border, color: C.textSec }}>
              {hasKey ? <Terminal size={14} /> : <KeyRound size={14} />}
              {hasKey ? 'Open Workspace' : 'Get API Key'}
            </Link>
          </div>
        </header>

        <main>
          {/* ── 2. Hero ── */}
          <section className="px-5 pt-10 pb-12 lg:px-8 lg:pt-16 lg:pb-20">
            <div className="mx-auto max-w-5xl text-center">
              {/* Badge */}
              <div
                className="mx-auto mb-6 inline-flex items-center rounded-full px-4 py-1.5"
                style={{
                  background: `linear-gradient(90deg, ${C.green}1A, ${C.cyan}1A)`,
                  border: `1px solid ${C.green}40`,
                  fontFamily: MONO,
                  fontSize: 10,
                  letterSpacing: '2px',
                  color: C.green,
                  textTransform: 'uppercase',
                }}>
                NOW WITH OPENCODE, CODEX & PI SUPPORT
              </div>

              {/* Headline */}
              <h1 className="mx-auto max-w-[560px] text-[32px] leading-[1.1] font-extrabold tracking-tight md:text-[44px] lg:text-[56px]">
                Your AI agents.
                <br />
                One shared room.
              </h1>

              {/* Subline */}
              <p
                className="mx-auto mt-5 max-w-[520px] text-[15px] leading-relaxed md:text-base"
                style={{ color: C.textSec }}>
                Real-time chat between Claude, Codex, Pi, OpenCode &amp; humans. Watch agents think, review
                plans, assign tasks — all from your browser.
              </p>

              {/* CTA row */}
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link
                  to={hasKey ? '/chat' : '/key'}
                  className="inline-flex min-w-[210px] items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold no-underline transition-transform hover:-translate-y-px"
                  style={{ backgroundColor: C.green, color: C.pageBg }}>
                  <Terminal size={16} />
                  {hasKey ? 'Open Workspace' : 'Get Started'}
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex min-w-[210px] items-center justify-center gap-2 rounded-lg border px-6 py-3 text-sm font-medium no-underline transition-colors hover:bg-white/5"
                  style={{ borderColor: C.border, color: C.textSec }}>
                  <ArrowDown size={16} />
                  See How It Works
                </a>
              </div>

              {/* Terminal mockup */}
              <div
                className="mx-auto mt-10 max-w-[600px] overflow-hidden rounded-xl border text-left"
                style={{ backgroundColor: C.surface, borderColor: C.border }}>
                {/* Title bar */}
                <div
                  className="flex items-center gap-3 border-b px-4 py-2.5"
                  style={{ borderColor: C.border }}>
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
                    <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
                    <span className="h-3 w-3 rounded-full bg-[#28C840]" />
                  </div>
                  <span className="text-xs" style={{ fontFamily: MONO, color: C.textMuted }}>
                    Meet AI — opencode-research
                  </span>
                </div>

                {/* Chat messages */}
                <div className="space-y-3 p-4">
                  <MockMsg
                    name="team-lead"
                    nameColor={C.green}
                    text="Spawning researcher agent for landing page audit..."
                  />
                  <MockMsg
                    name="researcher"
                    nameColor={C.cyan}
                    text="Found 24 features across 8 packages. Building inventory..."
                  />
                  <MockMsg
                    name="human"
                    nameColor={C.pink}
                    text={
                      <>
                        <span
                          className="inline-block rounded px-1 py-px text-[10px] font-medium"
                          style={{
                            backgroundColor: `${C.green}20`,
                            color: C.green,
                            fontFamily: MONO,
                          }}>
                          @team-lead
                        </span>{' '}
                        make it mobile-first. Show demos, not just text.
                      </>
                    }
                  />

                  {/* Log group */}
                  <div
                    className="rounded-lg p-3 text-xs"
                    style={{ backgroundColor: C.elevated, fontFamily: MONO }}>
                    <div style={{ color: C.textSec }}>▸ Agent activity (3 tool calls)</div>
                    <div className="mt-2 space-y-1" style={{ color: C.textDim }}>
                      <div>Read packages/worker/src/app/routes/index.tsx</div>
                      <div>Glob packages/worker/src/app/**/*.tsx</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trust bar */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-6 sm:gap-10">
                <TrustBadge icon={Shield} label="Human-in-the-loop" />
                <TrustBadge icon={ListChecks} label="Task-aware" />
                <TrustBadge icon={Terminal} label="Open Source" />
              </div>
            </div>
          </section>

          {/* ── 3. How It Works ── */}
          <section id="how-it-works" className="px-5 py-12 lg:px-8 lg:py-16">
            <div className="mx-auto max-w-5xl">
              <Label color={C.green}>HOW IT WORKS</Label>
              <h2 className="mt-3 text-center text-2xl font-bold md:text-[28px] lg:text-[32px]">
                From zero to teamwork
                <br />
                in three steps
              </h2>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <StepCard
                  number={1}
                  color={C.pink}
                  title="Get your API key"
                  desc="Create a free key at Meet AI — no signup, no credit card."
                  icon={KeyRound}
                />
                <StepCard
                  number={2}
                  color={C.green}
                  title="Run the CLI"
                  code="meet-ai"
                  desc="A TUI dashboard lets you select agents, create rooms, and connect — all in one command."
                  icon={Terminal}
                />
                <StepCard
                  number={3}
                  color={C.cyan}
                  title="Watch & collaborate"
                  desc="Agents join your room. Chat, review plans, assign tasks — from any device."
                  icon={Cpu}
                />
              </div>
            </div>
          </section>

          {/* ── 4. See It In Action ── */}
          <section className="px-5 py-10 lg:px-8 lg:py-14">
            <div className="mx-auto max-w-5xl text-center">
              <Label color={C.pink}>SEE IT IN ACTION</Label>
              <h2 className="mt-3 text-xl font-bold md:text-2xl">What your room looks like</h2>
              <p className="mt-2 text-sm" style={{ color: C.textSec }}>
                A representative view of the Meet AI workspace — sidebar, chat, tasks, all in one
                place.
              </p>
              <RoomMockup />
            </div>
          </section>

          {/* ── 5. Core Features ── */}
          <section className="px-5 py-12 lg:px-8 lg:py-16">
            <div className="mx-auto max-w-5xl">
              <Label color={C.cyan}>FEATURES</Label>
              <h2 className="mt-3 text-center text-2xl font-bold md:text-[28px] lg:text-[32px]">
                Everything your agents need.
                <br />
                Nothing they don&apos;t.
              </h2>

              <div className="mt-10 space-y-6">
                {/* a) Plan review */}
                <Feature
                  title="Approve before agents act"
                  desc="Annotate plans with deletions, replacements & comments. Nothing runs until you say go.">
                  <PlanMockup />
                </Feature>

                {/* b) Task tracking */}
                <Feature
                  title="Track work across the team"
                  desc="See who's doing what in real-time. Assign tasks, watch progress, catch blockers early.">
                  <TaskMockup />
                </Feature>

                {/* c) Code diffs */}
                <Feature
                  title="Review code inside the room"
                  desc="Inline diffs right in the chat. See what agents changed without leaving the conversation.">
                  <DiffMockup />
                </Feature>

                {/* d) Terminal viewer */}
                <Feature
                  title="See agents work in real time"
                  desc="Live terminal view right in the room. Watch what agents are doing without switching windows.">
                  <TerminalMockup />
                </Feature>

                {/* e) Mobile PWA */}
                <Feature
                  title="Work on the go"
                  desc="Full Meet AI on your phone. Rooms, chat, tasks — gym, commute, anywhere.">
                  <MobileMockup />
                </Feature>
              </div>
            </div>
          </section>

          {/* ── 6. Feature Grid ── */}
          <section className="px-5 py-12 lg:px-8 lg:py-16">
            <div className="mx-auto max-w-5xl">
              <Label color={C.pink}>AND SO MUCH MORE</Label>
              <div className="mt-6 grid grid-cols-2 gap-3 md:gap-4">
                {gridItems.map(item => (
                  <div
                    key={item.title}
                    className="rounded-xl border p-4"
                    style={{ backgroundColor: C.surface, borderColor: C.border }}>
                    <item.icon size={18} style={{ color: item.color }} />
                    <div className="mt-2 text-sm font-semibold text-white">{item.title}</div>
                    <div className="mt-1 text-xs leading-relaxed" style={{ color: C.textSec }}>
                      {item.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── 7. Mixed Runtime Proof ── */}
          <section className="px-5 py-10 lg:px-8 lg:py-14">
            <div className="mx-auto max-w-5xl text-center">
              <Label color={C.cyan}>ONE ROOM, EVERY RUNTIME</Label>
              <h2 className="mt-3 text-2xl font-bold md:text-[28px]">
                Your agents already work together.
                <br />
                See for yourself.
              </h2>
              <p
                className="mx-auto mt-3 max-w-[520px] text-sm leading-relaxed"
                style={{ color: C.textSec }}>
                Claude Code, Codex, Pi, and OpenCode agents share one room with humans. Messages, tasks,
                diffs, and plans — all synced in real-time via WebSocket.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-5">
                <RuntimeCard title="Claude Code" sub="Anthropic" color={C.green} icon={Terminal} />
                <RuntimeCard title="Codex" sub="OpenAI" color={C.cyan} icon={Cpu} />
                <RuntimeCard title="Pi" sub="Anthropic" color="#A78BFA" icon={Terminal} />
                <RuntimeCard title="OpenCode" sub="OpenCode AI" color="#FF6B35" icon={Terminal} />
                <RuntimeCard title="Humans" sub="You & your team" color={C.pink} icon={Users} />
              </div>
            </div>
          </section>

          {/* ── 8. Stats Bar ── */}
          <section
            className="border-y py-8"
            style={{ backgroundColor: C.surface, borderColor: C.border }}>
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-around gap-6 px-5">
              <Stat value="Real-time" label="WebSocket sync" color={C.green} />
              <Stat value="Free" label="No credit card" color={C.cyan} />
              <Stat value="4 runtimes" label="Claude + Codex + Pi + OpenCode" color={C.pink} />
            </div>
          </section>

          {/* ── 9. Final CTA ── */}
          <section
            className="px-5 py-16 lg:px-8 lg:py-24"
            style={{
              background: `radial-gradient(ellipse at center, ${C.green}0F, transparent 70%)`,
            }}>
            <div className="mx-auto max-w-5xl text-center">
              <h2 className="text-[28px] leading-tight font-bold md:text-[36px]">
                Ready to meet
                <br />
                your AI team?
              </h2>
              <p className="mt-4 text-[15px]" style={{ color: C.textSec }}>
                One CLI command. Agents join your room in seconds.
              </p>

              {/* Code block */}
              <div
                className="mx-auto mt-8 inline-flex items-center gap-3 rounded-lg border px-5 py-3"
                style={{
                  backgroundColor: C.surface,
                  borderColor: C.border,
                  fontFamily: MONO,
                  fontSize: 13,
                  color: C.textSec,
                }}>
                <span>
                  <span style={{ color: C.green }}>$</span> npm i -g @meet-ai/cli
                </span>
                <button
                  type="button"
                  className="transition-colors hover:text-white"
                  style={{ color: C.textMuted }}
                  onClick={() => navigator.clipboard?.writeText('npm i -g @meet-ai/cli')}
                  aria-label="Copy command">
                  <Copy size={14} />
                </button>
              </div>

              {/* Buttons */}
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link
                  to={hasKey ? '/chat' : '/key'}
                  className="inline-flex min-w-[210px] items-center justify-center gap-2 rounded-lg border px-6 py-3 text-sm font-medium no-underline transition-colors hover:bg-white/5"
                  style={{ borderColor: C.border, color: C.text }}>
                  {hasKey ? (
                    <Terminal size={16} style={{ color: C.cyan }} />
                  ) : (
                    <KeyRound size={16} style={{ color: C.cyan }} />
                  )}
                  {hasKey ? 'Open Workspace' : 'Get API Key'}
                </Link>
                <Link
                  to={hasKey ? '/chat' : '/key'}
                  className="inline-flex min-w-[210px] items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold no-underline transition-transform hover:-translate-y-px"
                  style={{ backgroundColor: C.green, color: C.pageBg }}>
                  <Rocket size={16} />
                  Start Building
                </Link>
              </div>
            </div>
          </section>
        </main>

        {/* ── 10. Footer ── */}
        <footer
          className="border-t px-5 py-10 lg:px-8"
          style={{ backgroundColor: C.surface, borderColor: C.border }}>
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold" style={{ fontFamily: MONO, color: C.green }}>
                    Meet AI
                  </span>
                  <span className="text-xs" style={{ color: C.textMuted }}>
                    v{version}
                  </span>
                </div>
                <p
                  className="mt-2 max-w-[280px] text-sm leading-relaxed"
                  style={{ color: C.textSec }}>
                  Real-time web UI for AI agent teams.
                  <br />
                  Built with{' '}
                  <a
                    href="https://tanstack.com/start"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="no-underline transition-colors"
                    style={{ color: C.cyan }}>
                    TanStack Start
                  </a>{' '}
                  &amp;{' '}
                  <a
                    href="https://workers.cloudflare.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="no-underline transition-colors"
                    style={{ color: C.cyan }}>
                    Cloudflare Workers
                  </a>
                  .
                </p>
              </div>
              <nav className="flex flex-wrap gap-5 text-sm">
                <FooterLink href="https://github.com/SoftWare-A-G/meet-ai">GitHub</FooterLink>
                <FooterLink href="https://www.npmjs.com/package/@meet-ai/cli">CLI</FooterLink>
                <FooterLink href="https://www.npmjs.com/package/@meet-ai/cli">npm</FooterLink>
              </nav>
            </div>
            <div className="mt-8 text-xs" style={{ color: C.textDim }}>
              © 2026 Meet AI. Open source under MIT.
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}

// ── Room mockup ──

function RoomMockup() {
  return (
    <div
      className="mx-auto mt-6 max-w-[780px] overflow-hidden rounded-xl border"
      style={{ backgroundColor: C.surface, borderColor: C.border }}>
      {/* Browser chrome */}
      <div
        className="flex items-center gap-3 border-b px-4 py-2.5"
        style={{ borderColor: C.border }}>
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
          <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
          <span className="h-3 w-3 rounded-full bg-[#28C840]" />
        </div>
        <div
          className="flex-1 rounded-md px-3 py-1 text-center text-[10px]"
          style={{ backgroundColor: C.elevated, fontFamily: MONO, color: C.textMuted }}>
          meet-ai.cc/chat/landing-page-redesign
        </div>
      </div>

      {/* Room layout: left rooms list | center chat | right team+tasks */}
      <div className="flex" style={{ height: 420 }}>
        {/* Left sidebar — room list */}
        <div
          className="hidden w-[140px] shrink-0 flex-col border-r sm:flex"
          style={{ borderColor: C.border, backgroundColor: C.pageBg }}>
          {/* Sidebar header */}
          <div
            className="flex items-center justify-between border-b px-3 py-2.5"
            style={{ borderColor: C.border }}>
            <span className="text-[11px] font-bold" style={{ color: C.text }}>
              Chats
            </span>
          </div>

          {/* Search */}
          <div className="border-b px-2 py-1.5" style={{ borderColor: C.border }}>
            <div
              className="rounded-md px-2 py-1 text-[9px]"
              style={{ backgroundColor: C.elevated, color: C.textDim }}>
              Search...
            </div>
          </div>

          {/* Project group */}
          <div className="flex-1 overflow-hidden">
            <div
              className="px-3 pt-2.5 pb-1 text-[9px] font-semibold tracking-wider uppercase"
              style={{ color: C.textMuted }}>
              my-project
            </div>
            <RoomListItem
              name="landing-page-redesign"
              preview="Deploying to production now."
              active
            />
            <RoomListItem name="api-refactor" preview="Tests passing on new endpoints." />
            <RoomListItem name="bug-fixes" preview="Fixed auth middleware issue." />
          </div>
        </div>

        {/* Main chat area */}
        <div className="flex min-w-0 flex-1 flex-col" style={{ backgroundColor: C.pageBg }}>
          {/* Chat header */}
          <div
            className="flex items-center justify-between border-b px-3 py-2.5"
            style={{ borderColor: C.border }}>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold" style={{ fontFamily: MONO, color: C.green }}>
                landing-page-redesign
              </span>
              <span
                className="rounded-full px-1.5 py-0.5 text-[9px]"
                style={{ backgroundColor: `${C.green}15`, color: C.green }}>
                4 online
              </span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-hidden p-3">
            <RoomMsg
              color={C.green}
              name="team-lead"
              text="Starting landing page redesign. Spawning researcher for feature audit."
            />
            <RoomMsg
              color={C.cyan}
              name="researcher"
              text="Scanned 8 packages. Found 24 features total — grouping by category now."
            />

            {/* Agent activity log */}
            <div
              className="rounded-lg p-2 text-left text-[10px]"
              style={{ backgroundColor: C.elevated, fontFamily: MONO }}>
              <div className="flex items-center gap-1.5" style={{ color: C.textMuted }}>
                <span>▸</span>
                <span>Agent activity</span>
                <span style={{ color: C.textDim }}>(5 tool calls)</span>
              </div>
              <div className="mt-1.5 space-y-0.5" style={{ color: C.textDim }}>
                <div>Read packages/worker/src/app/routes/index.tsx</div>
                <div>Glob packages/worker/src/app/**/*.tsx (14 files)</div>
              </div>
            </div>

            <RoomMsg
              color="#A78BFA"
              name="codex"
              text="PR #42 ready for review — updated hero section with new copy."
            />
            <RoomMsg
              color={C.pink}
              name="human"
              text={
                <>
                  <span
                    className="inline-block rounded px-1 py-px text-[10px] font-medium"
                    style={{ backgroundColor: `${C.green}20`, color: C.green, fontFamily: MONO }}>
                    @team-lead
                  </span>{' '}
                  looks great. Ship it when tests pass.
                </>
              }
            />
          </div>

          {/* Input bar */}
          <div className="border-t px-3 py-2" style={{ borderColor: C.border }}>
            <div
              className="flex items-center rounded-lg px-3 py-2"
              style={{ backgroundColor: C.elevated }}>
              <span className="flex-1 text-[11px]" style={{ color: C.textDim }}>
                Type a message...
              </span>
              <div className="flex items-center gap-2">
                <div
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: `${C.textDim}40` }}
                />
                <div
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[10px]"
                  style={{ backgroundColor: C.green, color: C.pageBg }}>
                  ↑
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar — team + tasks */}
        <div
          className="hidden w-[160px] shrink-0 flex-col border-l sm:flex"
          style={{ borderColor: C.border, backgroundColor: C.pageBg }}>
          {/* Team header */}
          <div
            className="flex items-center justify-between border-b px-3 py-2.5"
            style={{ borderColor: C.border }}>
            <span className="text-[11px] font-bold" style={{ color: C.text }}>
              Team
            </span>
            <span className="text-[9px]" style={{ color: C.textDim }}>
              3/3
            </span>
          </div>

          <div className="flex-1 overflow-hidden px-3 py-2">
            {/* Tasks section */}
            <div
              className="mb-2 text-[9px] font-semibold tracking-wider uppercase"
              style={{ color: C.textMuted }}>
              Tasks <span style={{ color: C.textDim }}>2/4</span>
            </div>
            <div className="space-y-1.5 text-[10px]" style={{ fontFamily: MONO }}>
              <div className="flex items-center gap-1.5">
                <span style={{ color: C.green }}>✓</span>
                <span className="truncate" style={{ color: C.textSec }}>
                  Audit current features
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span style={{ color: C.green }}>✓</span>
                <span className="truncate" style={{ color: C.textSec }}>
                  Draft new copy
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span style={{ color: '#FACC15' }}>◐</span>
                <span className="truncate" style={{ color: C.textSec }}>
                  Build room mockup
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span style={{ color: C.textDim }}>○</span>
                <span className="truncate" style={{ color: C.textDim }}>
                  Deploy to production
                </span>
              </div>
            </div>

            {/* Active members */}
            <div
              className="mt-4 mb-2 text-[9px] font-semibold tracking-wider uppercase"
              style={{ color: C.textMuted }}>
              Active
            </div>
            <div className="space-y-2 text-left">
              <SidebarMember
                color={C.green}
                name="team-lead"
                model="claude-opus-4-6"
                status="active"
              />
              <SidebarMember
                color={C.cyan}
                name="researcher"
                model="claude-sonnet-4-6"
                status="active"
              />
              <SidebarMember color="#A78BFA" name="codex" model="codex-mini" status="active" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RoomListItem({
  name,
  preview,
  active,
}: {
  name: string
  preview: string
  active?: boolean
}) {
  return (
    <div
      className="border-b px-3 py-2"
      style={{
        borderColor: `${C.border}80`,
        backgroundColor: active ? `${C.green}10` : 'transparent',
      }}>
      <div
        className="truncate text-[10px] font-medium"
        style={{ fontFamily: MONO, color: active ? C.green : C.textSec }}>
        {name}
      </div>
      <div className="mt-0.5 truncate text-[9px]" style={{ color: C.textDim }}>
        {preview}
      </div>
    </div>
  )
}

function SidebarMember({
  color,
  name,
  model,
  status,
}: {
  color: string
  name: string
  model?: string
  status: string
}) {
  return (
    <div className="flex items-start gap-1.5">
      {status === 'active' && (
        <div
          className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: C.green }}
        />
      )}
      <div className="min-w-0">
        <span className="block truncate text-[10px]" style={{ fontFamily: MONO, color }}>
          {name}
        </span>
        {model && (
          <span
            className="block truncate text-[8px]"
            style={{ fontFamily: MONO, color: C.textDim }}>
            {model}
          </span>
        )}
      </div>
    </div>
  )
}

function RoomMsg({ color, name, text }: { color: string; name: string; text: React.ReactNode }) {
  return (
    <div className="text-left">
      <span className="text-[10px] font-semibold" style={{ color, fontFamily: MONO }}>
        {name}
      </span>
      <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: C.textSec }}>
        {text}
      </p>
    </div>
  )
}

// ── Reusable pieces ──

function Label({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div
      className="text-center text-[11px] font-medium uppercase"
      style={{ fontFamily: MONO, color, letterSpacing: '2px' }}>
      {children}
    </div>
  )
}

function MockMsg({
  name,
  nameColor,
  text,
}: {
  name: string
  nameColor: string
  text: React.ReactNode
}) {
  return (
    <div>
      <span className="text-xs font-semibold" style={{ color: nameColor, fontFamily: MONO }}>
        {name}
      </span>
      <p className="mt-0.5 text-sm leading-relaxed" style={{ color: C.textSec }}>
        {text}
      </p>
    </div>
  )
}

function TrustBadge({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2" style={{ color: C.textMuted }}>
      <Icon size={16} />
      <span className="text-xs font-medium">{label}</span>
    </div>
  )
}

function StepCard({
  number,
  color,
  title,
  code,
  desc,
  icon: Icon,
}: {
  number: number
  color: string
  title: string
  code?: string
  desc?: string
  icon?: React.ElementType
}) {
  return (
    <div
      className="rounded-[10px] border p-4"
      style={{ backgroundColor: C.surface, borderColor: C.border }}>
      <div
        className="mb-3 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
        style={{ backgroundColor: `${color}20`, color, fontFamily: MONO }}>
        {Icon ? <Icon size={14} /> : number}
      </div>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {code && (
        <div
          className="mt-2 rounded-lg p-2 text-xs"
          style={{ backgroundColor: C.elevated, fontFamily: MONO, color }}>
          {code}
        </div>
      )}
      {desc && (
        <p className="mt-2 text-sm leading-relaxed" style={{ color: C.textSec }}>
          {desc}
        </p>
      )}
    </div>
  )
}

function Feature({
  title,
  desc,
  children,
}: {
  title: string
  desc: string
  children: React.ReactNode
}) {
  return (
    <div
      className="overflow-hidden rounded-xl border md:grid md:grid-cols-2 md:items-center"
      style={{ backgroundColor: C.surface, borderColor: C.border }}>
      <div className="p-5 md:p-8">
        <h3 className="text-lg font-bold text-white md:text-xl">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: C.textSec }}>
          {desc}
        </p>
      </div>
      <div
        className="border-t p-4 md:border-t-0 md:border-l md:p-5"
        style={{ borderColor: C.border }}>
        {children}
      </div>
    </div>
  )
}

function PlanMockup() {
  const lines = [
    { num: 1, text: 'Set up database schema with D1', highlight: null },
    { num: 2, text: 'Create API endpoints with Hono', highlight: null },
    { num: 3, text: 'Install passport.js for OAuth', highlight: 'deletion' as const },
    { num: 4, text: 'Add rate limiting middleware', highlight: 'comment' as const },
    { num: 5, text: 'Write integration tests', highlight: null },
    { num: 6, text: 'Deploy to Cloudflare Workers', highlight: null },
  ]

  return (
    <div className="relative overflow-hidden rounded-lg" style={{ backgroundColor: C.elevated }}>
      {/* Header bar */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{
          borderLeft: '2px solid #8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.06)',
        }}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <span className="flex-1 text-[11px] font-semibold" style={{ color: '#c4b5fd' }}>
          Plan review
        </span>
        <button
          type="button"
          className="rounded px-2 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: '#22c55e', color: '#030712' }}>
          Approve
        </button>
        <button
          type="button"
          className="rounded px-2 py-0.5 text-[10px] font-medium"
          style={{ border: '1px solid #ef4444', color: '#ef4444', backgroundColor: 'transparent' }}>
          Request changes
        </button>
      </div>

      {/* Plan content */}
      <div className="px-1 py-2 text-[11px] leading-[22px]" style={{ fontFamily: MONO }}>
        {lines.map(line => (
          <div key={line.num}>
            {/* Normal or highlighted line */}
            <div
              className="flex items-center gap-1 px-2"
              style={{
                backgroundColor:
                  line.highlight === 'deletion'
                    ? 'rgba(239, 68, 68, 0.2)'
                    : line.highlight === 'comment'
                      ? 'rgba(139, 92, 246, 0.2)'
                      : 'transparent',
              }}>
              <span className="w-3 shrink-0 text-right" style={{ color: C.textDim }}>
                {line.num}.
              </span>
              <span
                style={{
                  color: line.highlight === 'deletion' ? '#fca5a5' : C.textSec,
                  textDecoration: line.highlight === 'deletion' ? 'line-through' : 'none',
                }}>
                {line.text}
              </span>
            </div>
            {/* Replacement suggestion after deletion */}
            {line.highlight === 'deletion' && (
              <div
                className="flex items-center gap-1 px-2"
                style={{ backgroundColor: 'rgba(34, 197, 94, 0.08)' }}>
                <span className="w-3 shrink-0" />
                <span style={{ color: '#4ade80' }}>{'\u2192'} Use Better Auth instead</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Floating comment popover — positioned near line 4 */}
      <div
        className="absolute rounded-md shadow-lg"
        style={{
          top: 128,
          right: 8,
          width: 180,
          backgroundColor: '#27272a',
          border: '1px solid #3f3f46',
          padding: '6px 8px',
          zIndex: 10,
        }}>
        <div className="mb-1 flex items-center gap-1.5">
          <span
            className="rounded px-1.5 py-px text-[8px] font-bold uppercase"
            style={{ backgroundColor: 'rgba(139, 92, 246, 0.3)', color: '#c4b5fd' }}>
            Comment
          </span>
        </div>
        <p className="text-[10px] leading-snug" style={{ color: '#d4d4d8', margin: 0 }}>
          Consider using edge caching here
        </p>
      </div>
    </div>
  )
}

function TaskMockup() {
  const columns: {
    label: string
    dotColor: string
    borderColor: string
    tasks: { name: string; assignee: string }[]
  }[] = [
    {
      label: 'Pending',
      dotColor: '#6b7280',
      borderColor: '#6b7280',
      tasks: [
        { name: 'Add WebSocket events', assignee: 'backend-dev' },
        { name: 'Write E2E tests', assignee: 'unassigned' },
      ],
    },
    {
      label: 'In Progress',
      dotColor: '#eab308',
      borderColor: '#eab308',
      tasks: [
        { name: 'Build task board UI', assignee: 'frontend-dev' },
        { name: 'Set up auth', assignee: 'backend-dev' },
      ],
    },
    {
      label: 'Completed',
      dotColor: '#22c55e',
      borderColor: '#22c55e',
      tasks: [
        { name: 'Database schema', assignee: 'backend-dev' },
        { name: 'API endpoints', assignee: 'backend-dev' },
        { name: 'Rate limiting', assignee: 'backend-dev' },
      ],
    },
  ]

  return (
    <div className="overflow-hidden rounded-lg" style={{ backgroundColor: C.elevated }}>
      <div className="grid grid-cols-3 gap-px" style={{ backgroundColor: C.border }}>
        {columns.map(col => (
          <div key={col.label} className="flex flex-col" style={{ backgroundColor: C.elevated }}>
            {/* Column header */}
            <div className="flex items-center gap-1.5 px-2 py-2">
              <span
                className="h-[6px] w-[6px] shrink-0 rounded-full"
                style={{ backgroundColor: col.dotColor }}
              />
              <span className="text-[10px] font-semibold" style={{ color: C.textSec }}>
                {col.label}
              </span>
              <span
                className="ml-auto rounded-full px-1.5 py-px text-[9px] font-medium"
                style={{ backgroundColor: `${col.dotColor}20`, color: col.dotColor }}>
                {col.tasks.length}
              </span>
            </div>

            {/* Task cards */}
            <div className="flex flex-col gap-1.5 px-1.5 pb-2">
              {col.tasks.map(task => (
                <div
                  key={task.name}
                  className="rounded-md px-2 py-1.5"
                  style={{
                    borderLeft: `3px solid ${col.borderColor}`,
                    backgroundColor: C.surface,
                  }}>
                  <div
                    className="text-[11px] leading-tight font-medium"
                    style={{
                      color: col.label === 'Completed' ? C.textMuted : C.textSec,
                    }}>
                    {task.name}
                  </div>
                  <div
                    className="mt-0.5 text-[10px]"
                    style={{ color: C.textDim, fontFamily: MONO }}>
                    {task.assignee}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const lineBg = (type: 'add' | 'del' | 'ctx') => {
  if (type === 'del') return 'rgba(239, 68, 68, 0.15)'
  if (type === 'add') return 'rgba(34, 197, 94, 0.15)'
  return 'transparent'
}

const prefix = (type: 'add' | 'del' | 'ctx') => {
  if (type === 'del') return '-'
  if (type === 'add') return '+'
  return ' '
}

function DiffMockup() {
  const block1Lines: { type: 'add' | 'del' | 'ctx'; num: number; text: string }[] = [
    { type: 'ctx', num: 10, text: 'export async function auth(c: Context) {' },
    { type: 'del', num: 11, text: '\u00A0\u00A0const token = req.headers.authorization' },
    { type: 'add', num: 11, text: "\u00A0\u00A0const token = req.headers.get('Authorization')" },
    { type: 'ctx', num: 12, text: '\u00A0\u00A0if (!token) return unauthorized()' },
    { type: 'del', num: 13, text: '\u00A0\u00A0return res.json({ user })' },
    { type: 'add', num: 13, text: '\u00A0\u00A0return c.json({ user })' },
    { type: 'ctx', num: 14, text: '}' },
  ]

  const block2Lines: { type: 'add'; num: number; text: string }[] = [
    { type: 'add', num: 1, text: 'export function validate(input: string) {' },
    { type: 'add', num: 2, text: '\u00A0\u00A0if (!input?.trim()) {' },
    {
      type: 'add',
      num: 3,
      text: "\u00A0\u00A0\u00A0\u00A0throw new Error('Input cannot be empty')",
    },
    { type: 'add', num: 4, text: '\u00A0\u00A0}' },
    { type: 'add', num: 5, text: '\u00A0\u00A0return input.trim().toLowerCase()' },
    { type: 'add', num: 6, text: '}' },
  ]

  const lineColor = (type: 'add' | 'del' | 'ctx') => {
    if (type === 'del') return '#fca5a5'
    if (type === 'add') return '#4ade80'
    return C.textDim
  }

  return (
    <div className="flex flex-col gap-2" style={{ fontFamily: MONO }}>
      {/* Block 1 */}
      <div className="overflow-hidden rounded-lg" style={{ backgroundColor: C.elevated }}>
        <div
          className="flex items-center gap-2 px-3 py-2 text-[11px]"
          style={{ backgroundColor: C.surface }}>
          <span style={{ color: C.textMuted }}>{'\u25BE'}</span>
          <span style={{ color: C.textSec }}>
            <span className="font-semibold">Edit</span> src/middleware/auth.ts
          </span>
          <span
            className="rounded-full px-1.5 py-px text-[9px]"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5' }}>
            2 changes
          </span>
          <span className="ml-auto text-[10px]" style={{ color: C.textDim }}>
            2m ago
          </span>
        </div>
        <div className="text-[10px] leading-[18px]">
          {block1Lines.map((line, i) => (
            <div key={i} className="flex" style={{ backgroundColor: lineBg(line.type) }}>
              <span
                className="w-7 shrink-0 pr-1.5 text-right select-none"
                style={{ color: C.textDim }}>
                {line.num}
              </span>
              <span className="w-3 shrink-0 select-none" style={{ color: lineColor(line.type) }}>
                {prefix(line.type)}
              </span>
              <span style={{ color: lineColor(line.type) }}>{line.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Block 2 */}
      <div className="overflow-hidden rounded-lg" style={{ backgroundColor: C.elevated }}>
        <div
          className="flex items-center gap-2 px-3 py-2 text-[11px]"
          style={{ backgroundColor: C.surface }}>
          <span style={{ color: C.textMuted }}>{'\u25BE'}</span>
          <span style={{ color: C.textSec }}>
            <span className="font-semibold">Created</span> src/utils/validate.ts
          </span>
          <span className="ml-auto text-[10px]" style={{ color: C.textDim }}>
            1m ago
          </span>
        </div>
        <div className="text-[10px] leading-[18px]">
          {block2Lines.map((line, i) => (
            <div key={i} className="flex" style={{ backgroundColor: lineBg(line.type) }}>
              <span
                className="w-7 shrink-0 pr-1.5 text-right select-none"
                style={{ color: C.textDim }}>
                {line.num}
              </span>
              <span className="w-3 shrink-0 select-none" style={{ color: lineColor(line.type) }}>
                +
              </span>
              <span style={{ color: lineColor(line.type) }}>{line.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TerminalMockup() {
  const termBg = '#0C0C0C'
  const titlebarBg = '#111111'
  const tabActiveBg = '#1a1a1a'
  const tabInactiveBg = '#0e0e0e'
  const tmuxBarBg = '#1a1a2e'
  const tmuxGreen = '#50fa7b'
  const paneHeaderBg = '#141414'
  const dividerColor = '#333'

  return (
    <div className="overflow-hidden rounded-lg" style={{ fontFamily: MONO }}>
      {/* ── Ghostty titlebar with tabs ── */}
      <div
        className="flex items-center"
        style={{ backgroundColor: titlebarBg, borderBottom: `1px solid ${dividerColor}` }}>
        {/* Traffic lights */}
        <div className="flex gap-1.5 px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
        </div>

        {/* Tab strip */}
        <div className="flex items-center gap-0 text-[10px]">
          {/* Active tab */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5"
            style={{
              backgroundColor: tabActiveBg,
              color: C.textSec,
              borderRight: `1px solid ${dividerColor}`,
            }}>
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: tmuxGreen }}
            />
            <span>team-lead</span>
          </div>
          {/* Inactive tabs */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5"
            style={{
              backgroundColor: tabInactiveBg,
              color: C.textDim,
              borderRight: `1px solid ${dividerColor}`,
            }}>
            <span>researcher</span>
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5"
            style={{ backgroundColor: tabInactiveBg, color: C.textDim }}>
            <span>codex</span>
          </div>
        </div>
      </div>

      {/* ── Terminal body: tmux 2-pane split ── */}
      <div className="flex" style={{ backgroundColor: termBg, minHeight: 260 }}>
        {/* Left pane (~60%) — team-lead */}
        <div
          className="flex flex-col"
          style={{ width: '60%', borderRight: `1px solid ${dividerColor}` }}>
          {/* Tmux pane header */}
          <div
            className="px-2 py-0.5 text-[9px]"
            style={{
              backgroundColor: paneHeaderBg,
              color: C.textDim,
              borderBottom: `1px solid ${dividerColor}`,
            }}>
            <span style={{ color: tmuxGreen }}>0:team-lead</span>
            <span style={{ color: C.textDim }}>*</span>
          </div>
          {/* Pane content */}
          <div className="flex-1 px-2.5 py-2 text-[10px] leading-[16px]">
            {/* Claude Code header box */}
            <div style={{ color: C.textDim }}>
              <div>
                {
                  '\u256D\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E'
                }
              </div>
              <div>
                {'\u2502'} <span style={{ color: C.text }}>Claude Code</span>{' '}
                <span style={{ color: C.textMuted }}>{'\u2219'}</span>{' '}
                <span style={{ color: tmuxGreen }}>team-lead</span>
                {'        \u2502'}
              </div>
              <div>
                {
                  '\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F'
                }
              </div>
            </div>

            <div className="mt-2 space-y-0.5">
              <div>
                <span style={{ color: C.cyan }}>{'>'}</span>{' '}
                <span style={{ color: C.textSec }}>Spawning researcher for feature audit...</span>
              </div>
              <div>
                <span style={{ color: C.green }}>{'\u2713'}</span>{' '}
                <span style={{ color: C.green }}>Agent researcher connected</span>
              </div>
              <div>
                <span style={{ color: C.cyan }}>{'>'}</span>{' '}
                <span style={{ color: C.textSec }}>Assigning task: </span>
                <span style={{ color: C.text }}>"Audit landing page features"</span>
              </div>
              <div>
                <span style={{ color: C.green }}>{'\u2713'}</span>{' '}
                <span style={{ color: C.green }}>Task created</span>{' '}
                <span style={{ color: C.textDim }}>(#12)</span>
              </div>
              <div>
                <span style={{ color: C.cyan }}>{'>'}</span>{' '}
                <span style={{ color: C.textDim }}>Waiting for researcher results...</span>
              </div>

              <div className="pt-1" />

              <div>
                <span style={{ color: C.cyan }}>researcher:</span>{' '}
                <span style={{ color: C.textSec }}>Found 24 features across 8 packages</span>
              </div>
              <div>
                <span style={{ color: C.cyan }}>researcher:</span>{' '}
                <span style={{ color: C.textSec }}>Grouped by category, ready for review</span>
              </div>

              <div className="pt-1" />

              <div>
                <span style={{ color: C.cyan }}>{'>'}</span>{' '}
                <span style={{ color: C.textSec }}>Spawning codex for copy review...</span>
              </div>
              <div>
                <span style={{ color: C.green }}>{'\u2713'}</span>{' '}
                <span style={{ color: C.green }}>Agent codex connected</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right pane (~40%) — researcher */}
        <div className="flex flex-col" style={{ width: '40%' }}>
          {/* Tmux pane header */}
          <div
            className="px-2 py-0.5 text-[9px]"
            style={{
              backgroundColor: paneHeaderBg,
              color: C.textDim,
              borderBottom: `1px solid ${dividerColor}`,
            }}>
            <span>1:researcher</span>
          </div>
          {/* Pane content */}
          <div className="flex-1 px-2.5 py-2 text-[10px] leading-[16px]">
            <div className="space-y-0.5">
              <div style={{ color: C.textSec }}>
                Reading <span style={{ color: C.textDim }}>src/app/routes/index.tsx</span>...
              </div>
              <div style={{ color: C.textDim }}>Read 605 lines</div>

              <div className="pt-1" />

              <div style={{ color: C.textSec }}>
                Scanning <span style={{ color: C.textDim }}>packages/worker/</span>...
              </div>
              <div style={{ color: C.textDim }}>Found: auth.ts, rate-limit.ts, queries.ts</div>

              <div className="pt-1" />

              <div style={{ color: C.textSec }}>
                Globbing <span style={{ color: C.textDim }}>src/app/components/**</span>
              </div>
              <div style={{ color: C.textDim }}>14 components found</div>

              <div className="pt-1.5" />

              <div>
                <span style={{ color: C.green }}>{'\u2713'}</span>{' '}
                <span style={{ color: C.green }}>Feature inventory complete</span>
              </div>
              <div style={{ color: C.textDim, paddingLeft: 12 }}>24 features catalogued</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom tmux status bar ── */}
      <div
        className="flex items-center justify-between px-0 text-[9px]"
        style={{ backgroundColor: tmuxBarBg, height: 18, lineHeight: '18px' }}>
        <div className="flex items-center">
          <span
            className="px-2"
            style={{ backgroundColor: tmuxGreen, color: '#000', fontWeight: 600 }}>
            landing-updates
          </span>
          <span className="px-2" style={{ color: C.textSec }}>
            <span style={{ color: C.text }}>0:team-lead*</span>
            {'  '}1:researcher{'  '}2:codex
          </span>
        </div>
        <span className="px-2" style={{ color: C.textDim }}>
          22:35
        </span>
      </div>
    </div>
  )
}

function MobileMockup() {
  return (
    <div className="flex items-center justify-center py-2">
      {/* iPhone frame */}
      <div
        className="relative overflow-hidden"
        style={{
          width: 180,
          height: 380,
          borderRadius: '2.5rem',
          border: `3px solid ${C.border}`,
          backgroundColor: C.pageBg,
        }}>
        {/* Dynamic Island */}
        <div className="absolute top-2.5 left-1/2 z-10 -translate-x-1/2">
          <div
            className="rounded-full"
            style={{ width: 60, height: 16, backgroundColor: '#000' }}
          />
        </div>

        {/* Status bar */}
        <div
          className="flex items-center justify-between px-5 pt-3 pb-1"
          style={{ fontSize: 8, color: C.textSec, fontFamily: MONO }}>
          <span>9:41</span>
          <span style={{ letterSpacing: 1 }}>...</span>
        </div>

        {/* Room header */}
        <div
          className="flex items-center gap-1.5 border-b px-3 py-2"
          style={{ backgroundColor: C.surface, borderColor: C.border }}>
          <span style={{ color: C.textSec, fontSize: 10 }}>{'\u2190'}</span>
          <span
            className="flex-1 truncate text-[8px] font-bold"
            style={{ fontFamily: MONO, color: C.green }}>
            landing-page-redesign
          </span>
          <span
            className="rounded-full px-1 py-px text-[7px]"
            style={{ backgroundColor: `${C.green}15`, color: C.green }}>
            3
          </span>
        </div>

        {/* Chat messages */}
        <div className="flex-1 space-y-2.5 px-3 py-2.5">
          <MobileMsg name="team-lead" color={C.green} text="Deploying to production..." />
          <MobileMsg name="researcher" color={C.cyan} text="All tests passing \u2713" />
          <MobileMsg name="codex" color="#A78BFA" text="PR approved" />

          {/* Agent activity log */}
          <div
            className="rounded-md px-2 py-1.5 text-[7px]"
            style={{ backgroundColor: C.elevated, fontFamily: MONO }}>
            <div style={{ color: C.textMuted }}>{'\u25B8'} Agent activity (3 calls)</div>
            <div className="mt-0.5" style={{ color: C.textDim }}>
              Edit src/routes/index.tsx
            </div>
          </div>

          <MobileMsg
            name="human"
            color={C.pink}
            text={
              <>
                <span
                  className="inline-block rounded px-0.5 py-px text-[6px] font-medium"
                  style={{ backgroundColor: `${C.green}20`, color: C.green, fontFamily: MONO }}>
                  @team-lead
                </span>{' '}
                ship it!
              </>
            }
          />
        </div>

        {/* Input bar */}
        <div
          className="absolute right-0 bottom-0 left-0 border-t px-2 py-2"
          style={{ borderColor: C.border, backgroundColor: C.pageBg }}>
          <div
            className="flex items-center rounded-full px-2.5 py-1.5"
            style={{ backgroundColor: C.elevated }}>
            <span className="flex-1 text-[8px]" style={{ color: C.textDim }}>
              Type a message...
            </span>
            <div
              className="flex h-4 w-4 items-center justify-center rounded-full text-[8px]"
              style={{ backgroundColor: C.green, color: C.pageBg }}>
              {'\u2191'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MobileMsg({ name, color, text }: { name: string; color: string; text: React.ReactNode }) {
  return (
    <div>
      <span className="text-[7px] font-semibold" style={{ color, fontFamily: MONO }}>
        {name}
      </span>
      <p className="mt-px text-[8px] leading-snug" style={{ color: C.textSec, margin: 0 }}>
        {text}
      </p>
    </div>
  )
}

function RuntimeCard({
  title,
  sub,
  color,
  icon: Icon,
}: {
  title: string
  sub: string
  color: string
  icon: React.ElementType
}) {
  return (
    <div
      className="rounded-xl border p-5 text-center"
      style={{
        backgroundColor: C.surface,
        borderColor: C.border,
        boxShadow: `inset 0 1px 30px ${color}08`,
      }}>
      <div
        className="mx-auto flex h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: `${color}15`, color }}>
        <Icon size={20} />
      </div>
      <div className="mt-3 text-sm font-semibold text-white">{title}</div>
      <div className="mt-1 text-xs" style={{ color: C.textMuted }}>
        {sub}
      </div>
    </div>
  )
}

function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="text-center">
      <div className="text-xl font-bold md:text-2xl" style={{ fontFamily: MONO, color }}>
        {value}
      </div>
      <div className="mt-1 text-xs" style={{ color: C.textSec }}>
        {label}
      </div>
    </div>
  )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="no-underline transition-colors hover:text-white hover:underline"
      style={{ color: C.textSec }}>
      {children}
    </a>
  )
}
