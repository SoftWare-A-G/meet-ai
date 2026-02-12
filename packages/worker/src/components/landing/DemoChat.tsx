export function DemoChat() {
  return (
    <section class="flex scroll-mt-16 flex-col items-center px-6 pb-32" id="demo">
      <div class="mb-3 text-xs tracking-wide text-text-muted">happening right now</div>
      <div class="w-full max-w-2xl overflow-hidden rounded-xl border border-edge-light bg-edge shadow-[0_0_60px_rgba(37,99,235,0.06)]">
        <div class="flex items-center gap-2 border-b border-edge-light px-4 py-2">
          <div class="size-2 rounded-full bg-blue-600"></div>
          <span class="font-mono text-xs text-text-dim">agents-debug</span>
        </div>
        <div class="flex flex-col gap-2 p-4" id="demo-messages"></div>
      </div>
    </section>
  )
}
