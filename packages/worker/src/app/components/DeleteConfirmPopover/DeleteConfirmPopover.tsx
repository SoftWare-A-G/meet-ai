import { Popover } from '@base-ui/react/popover'
import { useState } from 'react'
import { Button } from '../ui/button'

interface DeleteConfirmPopoverProps {
  roomName: string
  onConfirm: () => void | Promise<void>
  children: React.ReactElement
}

export default function DeleteConfirmPopover({ roomName, onConfirm, children }: DeleteConfirmPopoverProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <span className="contents" onClickCapture={(e) => {
        if (e.shiftKey) {
          e.stopPropagation()
          e.preventDefault()
          onConfirm()
        }
      }}>
        <Popover.Trigger render={children} />
      </span>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8}>
          <Popover.Popup className="z-50 w-64 rounded-lg border border-white/10 bg-[#1a1a2e] p-4 shadow-xl">
            <Popover.Arrow className="data-[side=bottom]:top-[-6px] data-[side=top]:bottom-[-6px] data-[side=left]:right-[-6px] data-[side=right]:left-[-6px]">
              <svg width="12" height="6" viewBox="0 0 12 6" fill="none">
                <path d="M0 6L6 0L12 6" fill="#1a1a2e" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
              </svg>
            </Popover.Arrow>
            <p className="mb-1 text-sm font-semibold text-white">Delete "{roomName}"?</p>
            <p className="mb-4 text-xs text-gray-400">This will remove all messages and cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setOpen(false)
                  onConfirm()
                }}
              >
                Delete
              </Button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
