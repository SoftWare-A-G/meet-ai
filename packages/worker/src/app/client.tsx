import { StartClient } from '@tanstack/react-start/client'
import { startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'

startTransition(() => {
  hydrateRoot(document, <StartClient />)
})
