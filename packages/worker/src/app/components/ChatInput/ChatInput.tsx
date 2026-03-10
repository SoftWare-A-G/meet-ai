import { useRef, useCallback, useState, useMemo, useEffect, type RefObject } from 'react'
import clsx from 'clsx'
import { MentionsInput, Mention } from 'react-mentions-ts'
import type { MentionsInputClassNames, MentionsInputChangeEvent } from 'react-mentions-ts'
import { IconPaperclip, IconSend, IconMicrophone } from '../../icons'
import { useChatContext } from '../../lib/chat-context'
import { useVoiceInput } from '../../hooks/useVoiceInput'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

const preventBlur = (e: { preventDefault: () => void }) => e.preventDefault()

const isTouchDevice = () => matchMedia('(pointer: coarse)').matches

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

type InsertMentionEvent = CustomEvent<{ name: string }>

const mentionsClassNames: MentionsInputClassNames = {
  control: 'relative border-none',
  highlighter: 'pointer-events-none whitespace-pre-wrap break-words px-4 py-3 text-transparent leading-relaxed',
  input: 'w-full border-none outline-none bg-transparent text-msg-text px-4 py-3 min-h-[48px] max-h-[200px] text-base font-[inherit] resize-none leading-relaxed overflow-y-auto placeholder:opacity-50',
}

// Empty data disables the library's built-in suggestion dropdown.
// We render our own dropdown for @mentions (works on all platforms).
const emptyMentionData: { id: string; display: string }[] = []

export default function ChatInput({ roomName, onSend, onUploadFile }: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [value, setValue] = useState('')
  const [plainText, setPlainText] = useState('')

  const { teamInfo, commandsInfo } = useChatContext()

  const interimRef = useRef('')
  const baseTextRef = useRef('')

  const handleTranscript = useCallback((text: string, isFinal: boolean) => {
    const base = baseTextRef.current
    const separator = base && !base.endsWith(' ') ? ' ' : ''
    const newValue = base + separator + text
    setValue(newValue)
    setPlainText(newValue)
    if (isFinal) {
      baseTextRef.current = newValue
      interimRef.current = ''
    } else {
      interimRef.current = text
    }
  }, [])

  const { isSupported: voiceSupported, isListening, start: startVoice, stop: stopVoice } = useVoiceInput({ onTranscript: handleTranscript })

  const toggleVoice = useCallback(() => {
    if (isListening) {
      stopVoice()
    } else {
      baseTextRef.current = plainText
      interimRef.current = ''
      startVoice()
    }
  }, [isListening, startVoice, stopVoice, plainText])

  // Slash command autocomplete
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0)
  const dismissedQueryRef = useRef<string | null>(null)
  const prevSlashQueryRef = useRef<string | null>(null)
  const commandItemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const slashQuery = plainText.startsWith('/') ? plainText.slice(1) : null
  if (slashQuery !== prevSlashQueryRef.current) {
    prevSlashQueryRef.current = slashQuery
    dismissedQueryRef.current = null
    if (selectedCommandIndex !== 0) setSelectedCommandIndex(0)
  }

  const filteredCommands = useMemo(() => {
    if (slashQuery === null || !commandsInfo?.length) return []
    const q = slashQuery.toLowerCase()
    return commandsInfo.filter(c => c.name.toLowerCase().includes(q))
  }, [slashQuery, commandsInfo])

  const showCommandDropdown = filteredCommands.length > 0 && dismissedQueryRef.current !== slashQuery

  const selectCommand = useCallback((name: string) => {
    const newValue = `/${name} `
    setValue(newValue)
    setPlainText(newValue)
    dismissedQueryRef.current = null
    setSelectedCommandIndex(0)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  // @mention autocomplete — custom dropdown for all platforms.
  // The library's built-in suggestion mechanism is unreliable on mobile,
  // so we own trigger detection and rendering consistently everywhere.
  const mentionMembers = useMemo(() => {
    if (!teamInfo) return []
    return teamInfo.members
      .filter(m => m.status === 'active')
      .map(m => ({ id: m.name, display: m.name }))
  }, [teamInfo])

  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0)
  const dismissedMentionQueryRef = useRef<string | null>(null)
  const prevMentionQueryRef = useRef<string | null>(null)

  const mentionQuery = useMemo(() => {
    const match = plainText.match(/(?:^|\s)@([\w-]*)$/)
    return match ? match[1] : null
  }, [plainText])

  if (mentionQuery !== prevMentionQueryRef.current) {
    prevMentionQueryRef.current = mentionQuery
    dismissedMentionQueryRef.current = null
    if (selectedMentionIndex !== 0) setSelectedMentionIndex(0)
  }

  const filteredMentions = useMemo(() => {
    if (mentionQuery === null || !mentionMembers.length) return []
    const q = mentionQuery.toLowerCase()
    return mentionMembers.filter(m => m.display.toLowerCase().includes(q))
  }, [mentionQuery, mentionMembers])

  const showMentionDropdown = filteredMentions.length > 0 && dismissedMentionQueryRef.current !== mentionQuery
  const mentionItemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const selectMention = useCallback((name: string) => {
    const match = plainText.match(/(?:^|\s)@([\w-]*)$/)
    if (!match) return
    const prefixEnd = match.index! + (match[0].startsWith(' ') ? 1 : 0)
    const newText = `${plainText.slice(0, prefixEnd)}@${name} `
    setValue(newText)
    setPlainText(newText)
    dismissedMentionQueryRef.current = null
    setSelectedMentionIndex(0)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [plainText])

  const insertMentionAtCursor = useCallback((name: string) => {
    const textarea = inputRef.current
    const mentionText = `@${name} `
    const start = textarea?.selectionStart ?? plainText.length
    const end = textarea?.selectionEnd ?? plainText.length
    const nextText = `${plainText.slice(0, start)}${mentionText}${plainText.slice(end)}`

    setValue(nextText)
    setPlainText(nextText)
    dismissedMentionQueryRef.current = null
    setSelectedMentionIndex(0)

    requestAnimationFrame(() => {
      const active = inputRef.current
      if (!active) return
      const nextCaret = start + mentionText.length
      active.focus()
      active.setSelectionRange(nextCaret, nextCaret)
      active.scrollIntoView({ block: 'nearest' })
    })
  }, [plainText])

  const handleMentionsChange = useCallback((event: MentionsInputChangeEvent) => {
    setValue(event.value)
    setPlainText(event.plainTextValue)
  }, [])

  useEffect(() => {
    const handleInsertMention = (event: Event) => {
      const name = (event as InsertMentionEvent).detail?.name?.trim()
      if (!name) return
      insertMentionAtCursor(name)
    }

    window.addEventListener('meet-ai:insert-mention', handleInsertMention as EventListener)
    return () => {
      window.removeEventListener('meet-ai:insert-mention', handleInsertMention as EventListener)
    }
  }, [insertMentionAtCursor])

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
    const content = plainText.trim()
    if (!content) return

    if (isListening) stopVoice()

    const attachmentIds = pendingFiles
      .filter(f => f.status === 'done' && f.attachmentId)
      .map(f => f.attachmentId!)

    onSend(content, attachmentIds)
    setPendingFiles([])
    setValue('')
    setPlainText('')
    baseTextRef.current = ''
    interimRef.current = ''
    inputRef.current?.focus()
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      requestAnimationFrame(() => inputRef.current?.scrollIntoView({ block: 'nearest' }))
    })
  }, [onSend, pendingFiles, plainText, isListening, stopVoice])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // Slash command keyboard navigation
    if (showCommandDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const newIndex = (selectedCommandIndex + 1) % filteredCommands.length
        setSelectedCommandIndex(newIndex)
        commandItemRefs.current[newIndex]?.scrollIntoView({ block: 'nearest' })
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const newIndex = (selectedCommandIndex - 1 + filteredCommands.length) % filteredCommands.length
        setSelectedCommandIndex(newIndex)
        commandItemRefs.current[newIndex]?.scrollIntoView({ block: 'nearest' })
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        dismissedQueryRef.current = slashQuery
        setSelectedCommandIndex(0)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey && !isTouchDevice()) {
        e.preventDefault()
        selectCommand(filteredCommands[selectedCommandIndex].name)
        return
      }
    }
    // @mention keyboard navigation
    if (showMentionDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const newIndex = (selectedMentionIndex + 1) % filteredMentions.length
        setSelectedMentionIndex(newIndex)
        mentionItemRefs.current[newIndex]?.scrollIntoView({ block: 'nearest' })
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const newIndex = (selectedMentionIndex - 1 + filteredMentions.length) % filteredMentions.length
        setSelectedMentionIndex(newIndex)
        mentionItemRefs.current[newIndex]?.scrollIntoView({ block: 'nearest' })
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        dismissedMentionQueryRef.current = mentionQuery
        setSelectedMentionIndex(0)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey && !isTouchDevice()) {
        e.preventDefault()
        selectMention(filteredMentions[selectedMentionIndex].display)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !isTouchDevice()) {
      e.preventDefault()
      handleSend()
    }
  }, [showCommandDropdown, filteredCommands, selectedCommandIndex, slashQuery, selectCommand, showMentionDropdown, filteredMentions, selectedMentionIndex, mentionQuery, selectMention, handleSend])

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

  const sendDisabled = !plainText.trim() && !pendingFiles.some(f => f.status === 'done')

  return (
    <div className="chat-input-wrapper shrink-0 pb-[env(safe-area-inset-bottom)] bg-chat-bg">
      <div className="relative border-t border-b border-border bg-input-bg">
        {showCommandDropdown && (
          <div className="absolute bottom-full left-0 right-0 z-10 border border-border border-b-0 bg-input-bg shadow-xl rounded-t-lg overflow-hidden">
            <ul className="max-h-48 overflow-y-auto">
              {filteredCommands.map((cmd, i) => (
                <li key={cmd.name}>
                  <button
                    ref={(el) => { commandItemRefs.current[i] = el }}
                    type="button"
                    className={clsx(
                      'w-full text-left px-3 py-2 flex gap-2 items-baseline cursor-pointer border-none bg-transparent text-msg-text text-sm',
                      i === selectedCommandIndex ? 'bg-white/10' : 'hover:bg-white/5'
                    )}
                    onMouseDown={preventBlur}
                    onClick={() => selectCommand(cmd.name)}
                  >
                    <span className="font-semibold shrink-0">/{cmd.name}</span>
                    <span className="text-msg-text opacity-50 truncate">{cmd.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {showMentionDropdown && (
          <div className="absolute bottom-full left-0 right-0 z-10 border border-border border-b-0 bg-input-bg shadow-xl rounded-t-lg overflow-hidden">
            <ul className="max-h-48 overflow-y-auto">
              {filteredMentions.map((member, i) => (
                <li key={member.id}>
                  <button
                    ref={(el) => { mentionItemRefs.current[i] = el }}
                    type="button"
                    className={clsx(
                      'w-full text-left px-3 py-2 flex gap-2 items-baseline cursor-pointer border-none bg-transparent text-msg-text text-sm',
                      i === selectedMentionIndex ? 'bg-white/10' : 'hover:bg-white/5'
                    )}
                    onMouseDown={preventBlur}
                    onTouchStart={preventBlur}
                    onClick={() => selectMention(member.display)}
                  >
                    <span className="font-semibold shrink-0">@{member.display}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
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

        <MentionsInput
          value={value}
          onMentionsChange={handleMentionsChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={`Message #${roomName}`}
          inputRef={inputRef as unknown as RefObject<HTMLTextAreaElement>}
          autoResize
          classNames={mentionsClassNames}
        >
          <Mention
            trigger="@"
            data={emptyMentionData}
            displayTransform={(_id, display) => `@${display ?? _id}`}
            appendSpaceOnAdd
          />
        </MentionsInput>

        <div className="flex items-center justify-between px-3 h-[52px] border-t border-border">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-border bg-transparent text-msg-text opacity-70 hover:opacity-100 hover:bg-white/5 cursor-pointer text-sm transition-all"
              onMouseDown={preventBlur}
              onClick={handleFileSelect}
            >
              <IconPaperclip size={16} />
              Attach
            </button>

            {voiceSupported && (
              <button
                type="button"
                aria-label={isListening ? 'Stop recording' : 'Start voice input'}
                className={clsx(
                  'h-9 w-9 rounded-lg border flex items-center justify-center cursor-pointer text-sm transition-all',
                  isListening
                    ? 'bg-[#F85149]/20 border-[#F85149]/50 text-[#F85149] animate-pulse'
                    : 'border-border bg-transparent text-msg-text opacity-70 hover:opacity-100 hover:bg-white/5'
                )}
                onMouseDown={preventBlur}
                onClick={toggleVoice}
              >
                <IconMicrophone size={16} />
              </button>
            )}
          </div>

          <button
            type="button"
            aria-label="Send"
            disabled={sendDisabled}
            className={clsx(
              'h-9 w-9 rounded-lg bg-active text-active-text border-none flex items-center justify-center transition-all',
              sendDisabled
                ? 'opacity-50 cursor-default'
                : 'cursor-pointer hover:brightness-110'
            )}
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
