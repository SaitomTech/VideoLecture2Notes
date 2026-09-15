import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { extractRepresentativeFrame } from '../../../lib/media/ffmpeg'
import {
  getProjectVideoRangeThumbnailPath,
  removeProjectVideoRangeThumbnail,
} from '../../../lib/storage/projectAssets'
import type { CropRegion, PerspectiveCrop, ProjectVideo } from '../../../types/project'
import type { RangeDraft } from './rangeDraft'

type UseRangeThumbnailsInput = {
  projectId: string
  video: ProjectVideo
  rows: RangeDraft[]
  setRows: Dispatch<SetStateAction<RangeDraft[]>>
}

export function useRangeThumbnails({ projectId, video, rows, setRows }: UseRangeThumbnailsInput) {
  const rowsRef = useRef(rows)
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const controllersRef = useRef(new Map<string, AbortController>())
  const disposedRef = useRef(false)

  useEffect(() => {
    rowsRef.current = rows
  }, [rows])

  const refreshRangeThumbnail = useCallback(
    async (
      rowId: string,
      startMs: number,
      rowCrop?: CropRegion,
      rowPerspectiveCrop?: PerspectiveCrop,
    ) => {
      const previousController = controllersRef.current.get(rowId)
      previousController?.abort()
      const controller = new AbortController()
      controllersRef.current.set(rowId, controller)
      try {
        const thumbnailPath = await getProjectVideoRangeThumbnailPath(projectId, video.id, rowId)
        const fullCrop: CropRegion = {
          x: 0,
          y: 0,
          width: video.media.metadata.width,
          height: video.media.metadata.height,
        }
        await extractRepresentativeFrame({
          path: video.media.path,
          crop: rowCrop ?? fullCrop,
          perspectiveCrop: rowPerspectiveCrop,
          metadata: video.media.metadata,
          timestampMs: startMs,
          outputPath: thumbnailPath,
          signal: controller.signal,
        })
        if (disposedRef.current || controller.signal.aborted) return
        setRows((current) =>
          current.map((row) =>
            row.id === rowId ? { ...row, thumbnailPath, thumbnailVersion: Date.now() } : row,
          ),
        )
      } catch (cause) {
        if (!disposedRef.current && !controller.signal.aborted) {
          console.warn('記事区間のサムネイルを生成できませんでした', cause)
        }
      } finally {
        if (controllersRef.current.get(rowId) === controller) controllersRef.current.delete(rowId)
      }
    },
    [projectId, setRows, video],
  )

  const scheduleRangeThumbnail = useCallback(
    (
      rowId: string,
      startMs: number,
      rowCrop?: CropRegion,
      rowPerspectiveCrop?: PerspectiveCrop,
    ) => {
      const currentTimer = timersRef.current.get(rowId)
      if (currentTimer) clearTimeout(currentTimer)
      const timer = setTimeout(() => {
        timersRef.current.delete(rowId)
        void refreshRangeThumbnail(rowId, startMs, rowCrop, rowPerspectiveCrop)
      }, 180)
      timersRef.current.set(rowId, timer)
    },
    [refreshRangeThumbnail],
  )

  const removeRangeThumbnail = useCallback(
    async (rowId: string) => {
      const timer = timersRef.current.get(rowId)
      if (timer) clearTimeout(timer)
      timersRef.current.delete(rowId)
      controllersRef.current.get(rowId)?.abort()
      controllersRef.current.delete(rowId)
      await removeProjectVideoRangeThumbnail(projectId, video.id, rowId)
    },
    [projectId, video.id],
  )

  useEffect(() => {
    disposedRef.current = false
    const timers = timersRef.current
    const controllers = controllersRef.current
    return () => {
      disposedRef.current = true
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
      controllers.forEach((controller) => controller.abort())
      controllers.clear()
      const rowIds = new Set(rowsRef.current.map((row) => row.id))
      void Promise.all(
        [...rowIds].map((rowId) => removeProjectVideoRangeThumbnail(projectId, video.id, rowId)),
      )
    }
  }, [projectId, video.id])

  return { refreshRangeThumbnail, removeRangeThumbnail, scheduleRangeThumbnail }
}
