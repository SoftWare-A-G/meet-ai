import { parseSchema } from '../../lib/theme'
import { SCHEMA_LABELS } from '../../lib/constants'

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}

type ColorPreviewProps = {
  schema: string
}

export default function ColorPreview({ schema }: ColorPreviewProps) {
  const colors = parseSchema(schema)
  return (
    <div className="grid grid-cols-5 gap-2 mb-4">
      {colors.map((c, i) => {
        const textColor = getContrastColor(c)
        const shadowColor = textColor === '#000000' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'
        return (
          <div
            key={i}
            className="h-8 rounded-md flex items-center justify-center text-[10px] font-semibold"
            style={{ background: c, color: textColor, textShadow: `0 1px 2px ${shadowColor}` }}
            title={SCHEMA_LABELS[i]}
          >
            {SCHEMA_LABELS[i]}
          </div>
        )
      })}
    </div>
  )
}
