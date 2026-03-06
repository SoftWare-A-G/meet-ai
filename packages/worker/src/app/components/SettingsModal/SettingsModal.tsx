import { Dialog, DialogContent, DialogTitle } from '../ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
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
            <Select value={presetValue} onValueChange={handlePresetChange}>
              <SelectTrigger className="mb-3 w-full">
                <SelectValue placeholder="Custom">
                  {THEME_PRESETS.find(p => p.schema === presetValue)?.name ?? 'Custom'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Custom</SelectItem>
                {THEME_PRESETS.map(p => (
                  <SelectItem key={p.name} value={p.schema}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
