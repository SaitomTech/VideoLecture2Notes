import { invoke } from '@tauri-apps/api/core'
import { useEffect, useState } from 'react'

type VideoSourceUrlState = {
  path: string
  src: string | null
  error: string | null
}

export function useVideoSourceUrl(path: string): VideoSourceUrlState {
  const [state, setState] = useState<VideoSourceUrlState>({ path, src: null, error: null })

  useEffect(() => {
    let disposed = false

    void invoke<string>('video_stream_url', { path })
      .then((src) => {
        if (!disposed) setState({ path, src, error: null })
      })
      .catch((error: unknown) => {
        if (disposed) return
        const message = error instanceof Error ? error.message : String(error)
        setState({ path, src: null, error: message })
      })

    return () => {
      disposed = true
    }
  }, [path])

  return state.path === path ? state : { path, src: null, error: null }
}
