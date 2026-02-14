import type { MouseEvent } from 'react'

type IOSInstallModalProps = {
  onClose: () => void
}

export default function IOSInstallModal({ onClose }: IOSInstallModalProps) {
  return (
    <div className="fixed inset-0 bg-black/85 z-[999] flex items-center justify-center" onClick={onClose}>
      <div className="bg-chat-bg text-msg-text border border-border rounded-xl p-6 w-[340px] max-w-[90vw]" onClick={(e: MouseEvent) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4 text-center">Install meet-ai</h3>
        <div className="flex flex-col gap-3.5 mb-5">
          <div className="flex gap-3 items-start text-sm leading-relaxed">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-text flex items-center justify-center text-xs font-bold shrink-0">1</span>
            <span className="flex-1">
              Tap the <strong className="text-[#e5e5e5]">Share</strong> button
              <svg className="align-middle mx-0.5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
              in the toolbar
            </span>
          </div>
          <div className="flex gap-3 items-start text-sm leading-relaxed">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-text flex items-center justify-center text-xs font-bold shrink-0">2</span>
            <span className="flex-1">Scroll down and tap <strong className="text-[#e5e5e5]">Add to Home Screen</strong></span>
          </div>
          <div className="flex gap-3 items-start text-sm leading-relaxed">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-text flex items-center justify-center text-xs font-bold shrink-0">3</span>
            <span className="flex-1">Tap <strong className="text-[#e5e5e5]">Add</strong> in the top right</span>
          </div>
        </div>
        <button className="w-full py-2.5 border-none rounded-lg bg-primary text-primary-text text-sm font-semibold cursor-pointer hover:brightness-110" onClick={onClose}>Got it</button>
      </div>
    </div>
  )
}
