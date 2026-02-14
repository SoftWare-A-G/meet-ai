import { Dialog } from '@base-ui/react'
import { Select } from '@base-ui/react/select'
import { useState, useCallback } from 'react'
import { THEME_PRESETS, DEFAULT_SCHEMA } from '../../lib/constants'
import { applySchema } from '../../lib/theme'
import ColorPreview from '../ColorPreview'

type SettingsModalProps = {
  currentSchema: string
  onSave: (schema: string) => void
  onClose: () => void
}

export default function SettingsModal({ currentSchema, onSave, onClose }: SettingsModalProps) {
  const [schema, setSchema] = useState(currentSchema)
  const [presetValue, setPresetValue] = useState(() => {
    const match = THEME_PRESETS.find(p => p.schema === currentSchema)
    return match ? match.schema : ''
  })

  const savedSchema = currentSchema

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSchema(val)
    setPresetValue('')
    applySchema(val.trim())
  }, [])

  const handlePresetChange = useCallback((val: string | null) => {
    const v = val ?? ''
    setPresetValue(v)
    if (v) {
      setSchema(v)
      applySchema(v)
    }
  }, [])

  const handleSave = useCallback(() => {
    onSave(schema.trim())
  }, [schema, onSave])

  const handleCancel = useCallback(() => {
    applySchema(savedSchema)
    onClose()
  }, [savedSchema, onClose])

  const handleReset = useCallback(() => {
    setSchema(DEFAULT_SCHEMA)
    setPresetValue(DEFAULT_SCHEMA)
    applySchema(DEFAULT_SCHEMA)
  }, [])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        applySchema(savedSchema)
        onClose()
      }
    },
    [savedSchema, onClose]
  )

  return (
    <Dialog.Root open onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[100] bg-black/50" />
        <Dialog.Popup className="bg-chat-bg text-msg-text border-border fixed top-1/2 left-1/2 z-[100] max-h-[80vh] w-[460px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border p-6">
            <Dialog.Title className="mb-4 text-lg">Color Schema</Dialog.Title>
            <label className="mb-1 block text-[13px] font-semibold">Theme Presets</label>
            <Select.Root value={presetValue} onValueChange={handlePresetChange}>
              <Select.Trigger className="border-border text-msg-text mb-3 flex w-full cursor-pointer items-center justify-between rounded-md border bg-white/[0.08] px-2.5 py-2 text-base">
                <Select.Value placeholder="Custom" />
                <Select.Icon className="ml-2">&#9662;</Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner className="z-[200]">
                  <Select.Popup className="border-border bg-chat-bg max-h-[300px] overflow-y-auto rounded-md border p-1">
                    <Select.Item value="" className="text-msg-text cursor-pointer rounded px-2.5 py-1.5 text-sm data-[highlighted]:bg-white/10">
                      <Select.ItemText>Custom</Select.ItemText>
                    </Select.Item>
                    {THEME_PRESETS.map(p => (
                      <Select.Item key={p.name} value={p.schema} className="text-msg-text cursor-pointer rounded px-2.5 py-1.5 text-sm data-[highlighted]:bg-white/10">
                        <Select.ItemText>{p.name}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
            <label className="mb-1 block text-[13px] font-semibold">
              Schema string (10 comma-separated hex colors)
            </label>
            <input
              className="border-border text-msg-text mb-3 w-full rounded-md border bg-white/10 px-2.5 py-2 font-mono text-base"
              type="text"
              value={schema}
              onChange={handleInputChange}
            />
            <ColorPreview schema={schema} />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                className="text-primary border-border mr-auto cursor-pointer rounded-md border bg-transparent px-4 py-2 text-[13px] font-semibold"
                onClick={handleReset}>
                Reset
              </button>
              <button
                type="button"
                className="text-msg-text border-border cursor-pointer rounded-md border bg-transparent px-4 py-2 text-[13px] font-semibold"
                onClick={handleCancel}>
                Cancel
              </button>
              <button
                type="button"
                className="bg-primary text-primary-text cursor-pointer rounded-md border-none px-4 py-2 text-[13px] font-semibold"
                onClick={handleSave}>
                Save
              </button>
            </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
