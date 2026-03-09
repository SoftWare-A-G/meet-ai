import { useState, useRef, useCallback, useEffect } from 'react'
import type { UpdateState } from '@meet-ai/cli/lib/auto-update'
import {
  checkForUpdate,
  detectInstaller,
  downloadUpdate,
  getInstalledVersion,
} from '@meet-ai/cli/lib/auto-update'

export function useAutoUpdate(): {
  state: UpdateState
  triggerCheck: () => void
  triggerRestart: () => void
} {
  const [state, setState] = useState<UpdateState>({ status: 'idle' })
  const inFlight = useRef(false)

  const runCheck = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setState({ status: 'checking' })

    try {
      const result = await checkForUpdate()

      if (!result.available) {
        if (result.reason === 'offline') {
          setState({ status: 'offline' })
        } else if (result.reason === 'up to date') {
          setState({ status: 'up_to_date' })
        } else {
          setState({ status: 'failed', error: result.reason })
        }
        inFlight.current = false
        return
      }

      // Check if installer is supported before downloading
      if (!detectInstaller().supported) {
        setState({ status: 'update_unavailable', version: result.version })
        inFlight.current = false
        return
      }

      // Check if the target version is already installed globally
      // (e.g., user ran `npm i -g` manually while this process was running)
      const installedBefore = getInstalledVersion()
      if (installedBefore === result.version) {
        setState({ status: 'ready_to_restart', version: result.version })
        inFlight.current = false
        return
      }

      setState({ status: 'downloading', version: result.version })
      const dl = await downloadUpdate(result.version)

      if (dl.ok) {
        setState({ status: 'ready_to_restart', version: result.version })
      } else {
        // Download failed — but check if the version is now installed
        // (e.g., npm succeeded partially or was already installed)
        const installedAfter = getInstalledVersion()
        if (installedAfter === result.version) {
          setState({ status: 'ready_to_restart', version: result.version })
        } else {
          setState({ status: 'failed', error: dl.error })
        }
      }
    } catch (error) {
      setState({ status: 'failed', error: error instanceof Error ? error.message : String(error) })
    } finally {
      inFlight.current = false
    }
  }, [])

  const triggerCheck = useCallback(() => {
    if (inFlight.current) return
    if (state.status === 'update_unavailable') return
    void runCheck()
  }, [state.status, runCheck])

  const triggerRestart = useCallback(() => {
    // Caller handles confirmation and cleanup before calling restartApp()
  }, [])

  // Auto-check on mount
  useEffect(() => {
    void runCheck()
  }, [runCheck])

  return { state, triggerCheck, triggerRestart }
}
