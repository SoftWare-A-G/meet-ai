import clsx from 'clsx'

export interface PendingFile {
  file: File
  status: 'pending' | 'uploading' | 'done' | 'error'
  attachmentId?: string
  error?: string
}

interface AttachmentStripProps {
  files: PendingFile[]
  onRemove: (file: File) => void
}

export default function AttachmentStrip({ files, onRemove }: AttachmentStripProps) {
  return (
    <div className="flex flex-wrap gap-1.5 p-3 border-b border-border">
      {files.map((pf) => (
        <div
          className={clsx(
            'flex items-center gap-1 bg-white/[0.15] rounded-md px-2 py-1 text-xs max-w-[200px]',
            pf.status === 'error' && 'bg-[#F85149]/15 text-[#F85149]',
            pf.status === 'uploading' && 'opacity-70',
            pf.status === 'done' && 'bg-[#3AD900]/[0.12]'
          )}
          key={pf.file.name + pf.file.size}
        >
          <span className="overflow-hidden text-ellipsis whitespace-nowrap max-w-[120px]">{pf.file.name}</span>
          {pf.status === 'uploading' && <span className="opacity-60 whitespace-nowrap">uploading...</span>}
          {pf.status === 'error' && <span className="text-[11px] whitespace-nowrap">{pf.error}</span>}
          {pf.status === 'done' && <span className="opacity-60 whitespace-nowrap">ready</span>}
          <button
            type="button"
            className="bg-transparent border-none text-msg-text cursor-pointer text-sm px-0.5 opacity-50 leading-none hover:opacity-100"
            onClick={() => onRemove(pf.file)}
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
