import { useState, useCallback } from 'react'
import ColorPreview from '../ColorPreview'
import { THEME_PRESETS } from '../../lib/constants'
import { applySchema } from '../../lib/theme'
import { DEFAULT_SCHEMA, STORAGE_KEYS } from '../../lib/constants'

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

  const handlePresetChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setPresetValue(val)
    if (val) {
      setSchema(val)
      applySchema(val)
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

  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      applySchema(savedSchema)
      onClose()
    }
  }, [savedSchema, onClose])

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center" onClick={handleOverlayClick}>
      <div className="bg-chat-bg text-msg-text border border-border rounded-xl p-6 w-[460px] max-w-[90vw] max-h-[80vh] overflow-y-auto">
        <h2 className="mb-4 text-lg">Color Schema</h2>
        <label className="block text-[13px] font-semibold mb-1">Theme Presets</label>
        <select className="w-full px-2.5 py-2 border border-border rounded-md bg-white/[0.08] text-msg-text text-base mb-3 cursor-pointer" value={presetValue} onChange={handlePresetChange}>
          <option value="">Custom</option>
          {THEME_PRESETS.map(p => (
            <option key={p.name} value={p.schema}>{p.name}</option>
          ))}
        </select>
        <label className="block text-[13px] font-semibold mb-1">Schema string (10 comma-separated hex colors)</label>
        <input className="w-full px-2.5 py-2 border border-border rounded-md bg-white/10 text-msg-text text-base font-mono mb-3" type="text" value={schema} onChange={handleInputChange} />
        <ColorPreview schema={schema} />
        <div className="flex gap-2 justify-end mt-2">
          <button className="px-4 py-2 rounded-md text-[13px] cursor-pointer font-semibold bg-transparent text-primary border border-border mr-auto" onClick={handleReset}>Reset</button>
          <button className="px-4 py-2 rounded-md text-[13px] cursor-pointer font-semibold bg-transparent text-msg-text border border-border" onClick={handleCancel}>Cancel</button>
          <button className="px-4 py-2 rounded-md text-[13px] cursor-pointer font-semibold bg-primary text-primary-text border-none" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
