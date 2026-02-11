import { parseSchema } from '../../../lib/theme'
import { SCHEMA_LABELS } from '../../../lib/constants'

type ColorPreviewProps = {
  schema: string
}

export default function ColorPreview({ schema }: ColorPreviewProps) {
  const colors = parseSchema(schema)
  return (
    <div class="color-preview">
      {colors.map((c, i) => (
        <div
          key={i}
          class="color-swatch"
          style={`background:${c}`}
          title={SCHEMA_LABELS[i]}
        >
          {SCHEMA_LABELS[i]}
        </div>
      ))}
    </div>
  )
}
