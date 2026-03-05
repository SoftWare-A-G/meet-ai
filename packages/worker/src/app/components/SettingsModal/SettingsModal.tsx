import { Dialog, DialogContent, DialogTitle } from '../ui/dialog'
import { Select } from '@base-ui/react/select'
import { useState, useCallback } from 'react'
import { THEME_PRESETS, DEFAULT_SCHEMA } from '../../lib/constants'
import { applySchema } from '../../lib/theme'
import ColorPreview from '../ColorPreview'
import { Button } from '../ui/button'

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
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="bg-chat-bg text-msg-text max-h-[80vh] w-[460px] max-w-[90vw] sm:max-w-[460px] grid-cols-1 gap-0 overflow-y-auto p-6" showCloseButton={false}>
        <DialogTitle className="mb-4 text-lg">Color Schema</DialogTitle>
            <label className="mb-1 block text-[13px] font-semibold">Theme Presets</label>
            <Select.Root value={presetValue} onValueChange={handlePresetChange}>
              <Select.Trigger className="border-border text-msg-text mb-3 flex w-full cursor-pointer items-center justify-between rounded-md border bg-white/[0.08] px-2.5 py-2 text-base">
                <Select.Value placeholder="Custom">
                  {THEME_PRESETS.find(p => p.schema === presetValue)?.name ?? 'Custom'}
                </Select.Value>
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
              <Button
                variant="outline"
                className="mr-auto text-primary"
                onClick={handleReset}>
                Reset
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}>
                Save
              </Button>
            </div>
      </DialogContent>
    </Dialog>
  )
}
