import 'tldraw/tldraw.css'
import { useSync } from '@tldraw/sync'
import { useMemo } from 'react'
import {
  Tldraw,
  UserRecordType,
  computed,
  createUserId,
  iconTypes,
  type TLUiAssetUrlOverrides,
  type TLUiOverrides,
  type TLUserStore,
} from 'tldraw'

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
  icons: Object.fromEntries(iconTypes.map(name => [name, `/tldraw/icons/0_merged.svg#${name}`])),
}

const MEDIA_DISABLED_OVERRIDES: TLUiOverrides = {
  tools(_editor, tools) {
    const nextTools = { ...tools }
    delete nextTools.asset
    return nextTools
  },
  actions(_editor, actions) {
    return {
      ...actions,
      'insert-media': {
        ...actions['insert-media'],
        onSelect: () => {},
      },
      'replace-media': {
        ...actions['replace-media'],
        onSelect: () => {},
      },
    }
  },
}

export default function CanvasInner({ wsUrl, userName, userColor }: CanvasInnerProps) {
  const users = useMemo<TLUserStore>(() => ({
    currentUser: computed('current-user', () =>
      UserRecordType.create({
        id: createUserId(userName),
        name: userName,
        color: userColor,
      })
    ),
  }), [userName, userColor])

  const store = useSync({
    uri: wsUrl,
    assets: NO_OP_ASSETS,
    users,
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
      licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY}
      store={store.store}
      assetUrls={SELF_HOSTED_ASSET_URLS}
      acceptedImageMimeTypes={[]}
      acceptedVideoMimeTypes={[]}
      overrides={MEDIA_DISABLED_OVERRIDES}
      autoFocus
    />
  )
}
