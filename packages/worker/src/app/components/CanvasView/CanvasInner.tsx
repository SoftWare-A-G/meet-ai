import { Tldraw, iconTypes, type TLUiAssetUrlOverrides } from 'tldraw'
import { useSync } from '@tldraw/sync'
import 'tldraw/tldraw.css'

interface CanvasInnerProps {
  wsUrl: string
  userName: string
  userColor: string
}

const NO_OP_ASSETS = {
  async upload() {
    throw new Error('Asset uploads not yet supported')
  },
}

// Self-host the SVG sprite sheet to avoid cross-origin <use href> restrictions
const SELF_HOSTED_ASSET_URLS: TLUiAssetUrlOverrides = {
  icons: Object.fromEntries(
    iconTypes.map((name) => [name, `/tldraw/icons/0_merged.svg#${name}`])
  ),
}

export default function CanvasInner({ wsUrl, userName, userColor }: CanvasInnerProps) {
  const store = useSync({
    uri: wsUrl,
    assets: NO_OP_ASSETS,
    userInfo: { id: userName, name: userName, color: userColor },
  })

  if (store.status === 'loading') {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
        Connecting to canvas...
      </div>
    )
  }

  if (store.status === 'error') {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-red-400">
        Canvas error: {store.error.message}
      </div>
    )
  }

  return (
    <Tldraw
      store={store.store}
      assetUrls={SELF_HOSTED_ASSET_URLS}
      autoFocus
    />
  )
}
