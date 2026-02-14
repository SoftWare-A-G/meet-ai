import { parseSchema } from '../../../lib/theme'
import { SCHEMA_LABELS } from '../../../lib/constants'

type ColorPreviewProps = {
  schema: string
}

export default function ColorPreview({ schema }: ColorPreviewProps) {
  const colors = parseSchema(schema)
  return (
    <div className="grid grid-cols-5 gap-2 mb-4">
      {colors.map((c, i) => (
        <div
          key={i}
          className="h-8 rounded-md flex items-center justify-center text-[10px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]"
          style={{ background: c }}
          title={SCHEMA_LABELS[i]}
        >
          {SCHEMA_LABELS[i]}
        </div>
      ))}
    </div>
  )
}
