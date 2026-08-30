import { useEffect, useState } from 'react'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { isTauriEnvironment } from '../../../lib/tauri/environment'
import { pickVideoPath } from '../../../lib/tauri/dialog'
import { getFileSize } from '../../../lib/tauri/filesystem'
import type { VideoExtension } from '../../../types/media'
import { getExtension, getFileName, isSupportedVideo } from '../utils'
import type { SelectedVideo, VideoLoadStatus } from '../types'

export function useVideoPicker() {
  const [selectedVideo, setSelectedVideo] = useState<SelectedVideo | null>(null)
  const [videoStatus, setVideoStatus] = useState<VideoLoadStatus>('checking')
  const [isDragging, setIsDragging] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setVideo = async (path: string) => {
    const name = getFileName(path)
    const extension = getExtension(name)

    if (!isSupportedVideo(name)) {
      setError('対応していない形式です。動画ファイルを選択してください。')
      return
    }

    setSelectedVideo({
      name,
      path,
      extension: extension as VideoExtension,
    })
    setVideoStatus('checking')
    setError(null)

    try {
      const sizeBytes = await getFileSize(path)
      setSelectedVideo((current) => (current?.path === path ? { ...current, sizeBytes } : current))
    } catch (sizeError) {
      console.error(sizeError)
    }
  }

  const handleVideoReady = () => {
    setVideoStatus('ready')
    setError(null)
  }

  const handleVideoError = () => {
    setVideoStatus('error')
    setError('動画として読み込めないファイルです。別の動画を選択してください。')
  }

  useEffect(() => {
    if (!isTauriEnvironment()) return

    let disposed = false
    let unlisten: (() => void) | undefined

    void getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === 'enter' || event.payload.type === 'over') {
          setIsDragging(true)
          return
        }

        setIsDragging(false)

        if (event.payload.type === 'drop') {
          const path = event.payload.paths[0]
          if (path) void setVideo(path)
        }
      })
      .then((cleanup) => {
        if (disposed) {
          cleanup()
        } else {
          unlisten = cleanup
        }
      })

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

  const chooseVideo = async () => {
    setError(null)

    setIsSelecting(true)
    try {
      const selected = await pickVideoPath()
      if (selected) await setVideo(selected)
    } catch (selectionError) {
      console.error(selectionError)
      setError('動画を開けませんでした。もう一度お試しください。')
    } finally {
      setIsSelecting(false)
    }
  }

  return {
    selectedVideo,
    videoStatus,
    isDragging,
    isSelecting,
    error,
    chooseVideo,
    handleVideoReady,
    handleVideoError,
  }
}
