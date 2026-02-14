import React, { useRef, useCallback, useState } from 'react'
import clsx from 'clsx'
import { IconPaperclip, IconSend } from '../../icons'
import { useAutoResize } from '../../hooks/useAutoResize'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

const preventBlur = (e: { preventDefault: () => void }) => e.preventDefault()

type PendingFile = {
  file: File
  status: 'pending' | 'uploading' | 'done' | 'error'
  attachmentId?: string
  error?: string
}

type ChatInputProps = {
  roomName: string
  onSend: (content: string, attachmentIds: string[]) => void
  onUploadFile: (file: File) => Promise<{ id: string }>
}

export default function ChatInput({ roomName, onSend, onUploadFile }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { resize, reset } = useAutoResize(textareaRef)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])

  const addFiles = useCallback(async (files: File[]) => {
    const valid: PendingFile[] = []
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        valid.push({ file, status: 'error', error: 'File exceeds 5MB limit' })
      } else {
        valid.push({ file, status: 'pending' })
      }
    }

    setPendingFiles(prev => [...prev, ...valid])

    for (const pf of valid) {
      if (pf.status === 'error') continue
      setPendingFiles(prev => prev.map(f =>
        f.file === pf.file ? { ...f, status: 'uploading' as const } : f
      ))
      try {
        const result = await onUploadFile(pf.file)
        setPendingFiles(prev => prev.map(f =>
          f.file === pf.file ? { ...f, status: 'done' as const, attachmentId: result.id } : f
        ))
      } catch {
        setPendingFiles(prev => prev.map(f =>
          f.file === pf.file ? { ...f, status: 'error' as const, error: 'Upload failed' } : f
        ))
      }
    }
  }, [onUploadFile])

  const removeFile = useCallback((file: File) => {
    setPendingFiles(prev => prev.filter(f => f.file !== file))
  }, [])

  const handleSend = useCallback(() => {
    const el = textareaRef.current
    const content = el?.value.trim()
    if (!content || !el) return

    const attachmentIds = pendingFiles
      .filter(f => f.status === 'done' && f.attachmentId)
      .map(f => f.attachmentId!)

    onSend(content, attachmentIds)
    setPendingFiles([])
    reset()
    el.focus()
    requestAnimationFrame(() => el.focus())
  }, [onSend, reset, pendingFiles])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(pointer: coarse)').matches) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return
    const files: File[] = []
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) files.push(file)
      }
    }
    if (files.length > 0) {
      e.preventDefault()
      addFiles(files)
    }
  }, [addFiles])

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    if (input.files && input.files.length > 0) {
      addFiles(Array.from(input.files))
      input.value = ''
    }
  }, [addFiles])

  return (
    <div className="px-5 pb-[calc(14px+env(safe-area-inset-bottom,0px))] shrink-0">
      <div className="rounded-xl border border-border bg-input-bg">
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 p-3 border-b border-border">
            {pendingFiles.map((pf) => (
              <div className={clsx('flex items-center gap-1 bg-white/[0.15] rounded-md px-2 py-1 text-xs max-w-[200px]', pf.status === 'error' && 'bg-[#F85149]/15 text-[#F85149]', pf.status === 'uploading' && 'opacity-70', pf.status === 'done' && 'bg-[#3AD900]/[0.12]')} key={pf.file.name + pf.file.size}>
                <span className="overflow-hidden text-ellipsis whitespace-nowrap max-w-[120px]">{pf.file.name}</span>
                {pf.status === 'uploading' && <span className="opacity-60 whitespace-nowrap">uploading...</span>}
                {pf.status === 'error' && <span className="text-[11px] whitespace-nowrap">{pf.error}</span>}
                {pf.status === 'done' && <span className="opacity-60 whitespace-nowrap">ready</span>}
                <button type="button" className="bg-transparent border-none text-msg-text cursor-pointer text-sm px-0.5 opacity-50 leading-none hover:opacity-100" onClick={() => removeFile(pf.file)} title="Remove">×</button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          className="w-full border-none outline-none bg-transparent text-msg-text px-4 py-3 min-h-[48px] max-h-[200px] text-base font-[inherit] resize-none leading-relaxed overflow-y-auto placeholder:opacity-50"
          placeholder={`Message #${roomName}`}
          rows={1}
          onInput={resize}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
        />

        <div className="flex items-center justify-between p-2 border-t border-border">
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-border bg-transparent text-msg-text opacity-70 hover:opacity-100 hover:bg-white/5 cursor-pointer text-sm transition-all"
            onMouseDown={preventBlur}
            onClick={handleFileSelect}
          >
            <IconPaperclip size={16} />
            Attach
          </button>

          <button
            type="button"
            aria-label="Send"
            className="h-9 w-9 rounded-lg bg-active text-active-text border-none cursor-pointer flex items-center justify-center hover:brightness-110 transition-all"
            onMouseDown={preventBlur}
            onClick={handleSend}
          >
            <IconSend size={16} />
          </button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
    </div>
  )
}
