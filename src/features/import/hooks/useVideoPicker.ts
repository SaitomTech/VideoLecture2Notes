import { useEffect, useRef, useState } from 'react'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { isTauriEnvironment } from '../../../lib/tauri/environment'
import { pickVideoPath } from '../../../lib/tauri/dialog'
import { getFileSize } from '../../../lib/tauri/filesystem'
import { probeVideo } from '../../../lib/media/ffprobe'
import type { VideoExtension } from '../../../types/media'
import { getExtension, getFileName, isSupportedVideo } from '../utils'
import type { MetadataLoadStatus, SelectedVideo, VideoLoadStatus } from '../types'

export function useVideoPicker(initialVideo?: SelectedVideo) {
  const [selectedVideo, setSelectedVideo] = useState<SelectedVideo | null>(initialVideo ?? null)
  const [videoStatus, setVideoStatus] = useState<VideoLoadStatus>('checking')
  const [metadataStatus, setMetadataStatus] = useState<MetadataLoadStatus>(
    initialVideo?.metadata ? 'ready' : 'idle',
  )
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectionVersion = useRef(0)

  const setVideo = async (path: string) => {
    const name = getFileName(path)
    const extension = getExtension(name)
    const currentVersion = selectionVersion.current + 1
    selectionVersion.current = currentVersion

    if (!isSupportedVideo(name)) {
      setVideoStatus('error')
      setMetadataStatus('error')
      setError('対応していない形式です。動画ファイルを選択してください。')
      return
    }

    setSelectedVideo({
      name,
      path,
      extension: extension as VideoExtension,
    })
    setVideoStatus('checking')
    setMetadataStatus('checking')
    setMetadataError(null)
    setError(null)

    try {
      const sizeBytes = await getFileSize(path)
      if (selectionVersion.current === currentVersion) {
        setSelectedVideo((current) =>
          current?.path === path ? { ...current, sizeBytes } : current,
        )
      }
    } catch (sizeError) {
      console.error(sizeError)
    }

    try {
      const metadata = await probeVideo(path)
      if (selectionVersion.current !== currentVersion) return
      setSelectedVideo((current) => (current?.path === path ? { ...current, metadata } : current))
      setMetadataStatus('ready')
    } catch (probeError) {
      if (selectionVersion.current !== currentVersion) return
      console.error(probeError)
      setMetadataStatus('error')
      setMetadataError('動画情報を解析できませんでした。sidecarの準備状態を確認してください。')
    }
  }

  const handleVideoReady = () => {
    setVideoStatus('ready')
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
    metadataStatus,
    metadataError,
    isDragging,
    isSelecting,
    error,
    chooseVideo,
    handleVideoReady,
    handleVideoError,
  }
}
