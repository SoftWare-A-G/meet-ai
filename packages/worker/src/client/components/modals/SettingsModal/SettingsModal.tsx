import { useState, useCallback } from 'hono/jsx/dom'
import ColorPreview from '../ColorPreview'
import { THEME_PRESETS } from '../../../lib/constants'
import { applySchema } from '../../../lib/theme'
import { DEFAULT_SCHEMA, STORAGE_KEYS } from '../../../lib/constants'

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

  const handleInputChange = useCallback((e: Event) => {
    const val = (e.target as HTMLInputElement).value
    setSchema(val)
    setPresetValue('')
    applySchema(val.trim())
  }, [])

  const handlePresetChange = useCallback((e: Event) => {
    const val = (e.target as HTMLSelectElement).value
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

  const handleOverlayClick = useCallback((e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('settings-overlay')) {
      applySchema(savedSchema)
      onClose()
    }
  }, [savedSchema, onClose])

  return (
    <div class="settings-overlay" onClick={handleOverlayClick}>
      <div class="settings-panel">
        <h2>Color Schema</h2>
        <label>Theme Presets</label>
        <select value={presetValue} onChange={handlePresetChange}>
          <option value="">Custom</option>
          {THEME_PRESETS.map(p => (
            <option key={p.name} value={p.schema}>{p.name}</option>
          ))}
        </select>
        <label>Schema string (10 comma-separated hex colors)</label>
        <input type="text" value={schema} onInput={handleInputChange} />
        <ColorPreview schema={schema} />
        <div class="btn-row">
          <button class="btn-reset" onClick={handleReset}>Reset</button>
          <button class="btn-cancel" onClick={handleCancel}>Cancel</button>
          <button class="btn-save" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
