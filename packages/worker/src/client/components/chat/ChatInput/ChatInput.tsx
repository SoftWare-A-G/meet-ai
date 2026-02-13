import { useRef, useCallback, useState } from 'hono/jsx/dom'
import FormattingToolbar from '../FormattingToolbar'
import { useAutoResize } from '../../../hooks/useAutoResize'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

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

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(pointer: coarse)').matches) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    const files: File[] = []
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile()
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

  const handleFileChange = useCallback((e: Event) => {
    const input = e.target as HTMLInputElement
    if (input.files && input.files.length > 0) {
      addFiles(Array.from(input.files))
      input.value = ''
    }
  }, [addFiles])

  return (
    <div class="chat-input-area">
      <div class="chat-input-box">
        {pendingFiles.length > 0 && (
          <div class="chat-attachments-bar">
            {pendingFiles.map((pf) => (
              <div class={`chat-attachment-chip ${pf.status}`} key={pf.file.name + pf.file.size}>
                <span class="chip-name">{pf.file.name}</span>
                {pf.status === 'uploading' && <span class="chip-status">uploading...</span>}
                {pf.status === 'error' && <span class="chip-error">{pf.error}</span>}
                {pf.status === 'done' && <span class="chip-status">ready</span>}
                <button class="chip-remove" onClick={() => removeFile(pf.file)} title="Remove">×</button>
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          placeholder={`Message #${roomName}`}
          rows={1}
          onInput={resize}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style="display:none"
          onChange={handleFileChange}
        />
        <FormattingToolbar textareaRef={textareaRef} onSend={handleSend} onAttach={handleFileSelect} />
      </div>
    </div>
  )
}
