import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { useVideoSourceUrl } from '../../../lib/media/useVideoSourceUrl'
import { getErrorDetail } from '../../../lib/errors'
import { normalizedToPixelCrop, pixelToNormalizedCrop } from '../../crop/utils'
import type { NormalizedCropRegion } from '../../crop/types'
import { detectAutomaticCrop, type AutoCropProgress } from '../../crop/autoCrop'
import type {
  CropRegion,
  PerspectiveCorners,
  PerspectiveCrop,
  ProjectVideo,
  VideoTrimRange,
} from '../../../types/project'
import {
  CORNER_GRID_ORDER,
  type CropMode,
  type CropSnapshot,
  cloneCorners,
  cornersToRegion,
  estimatedAspectRatio,
  formatRangeInput,
  parseTime,
  rangeColor,
  rectToCorners,
  type RangeDraft,
  type TrimHandle,
} from './rangeDraft'
import { useRangeThumbnails } from './useRangeThumbnails'

type ArticleRange = { title: string; range: VideoTrimRange }

type UseArticleRangeEditorOptions = {
  projectId: string
  video: ProjectVideo
  onClose?: () => void
  initialRange?: VideoTrimRange
  initialTitle?: string
  initialCrop?: CropRegion
  initialPerspectiveCrop?: PerspectiveCrop
  autoCropOnOpen?: boolean
  onSubmit: (
    ranges: ArticleRange[],
    crop: CropRegion,
    perspectiveCrop?: PerspectiveCrop,
  ) => Promise<void>
}

function sameCrop(first: NormalizedCropRegion, second: NormalizedCropRegion) {
  return (
    first.x === second.x &&
    first.y === second.y &&
    first.width === second.width &&
    first.height === second.height
  )
}

function sameCorners(first: PerspectiveCorners, second: PerspectiveCorners) {
  return CORNER_GRID_ORDER.every(
    (corner) => first[corner].x === second[corner].x && first[corner].y === second[corner].y,
  )
}

export function useArticleRangeEditor({
  projectId,
  video,
  onClose,
  initialRange: requestedInitialRange,
  initialTitle,
  initialCrop: requestedInitialCrop,
  initialPerspectiveCrop,
  autoCropOnOpen = true,
  onSubmit,
}: UseArticleRangeEditorOptions) {
  const duration = video.media.metadata.durationMs
  const fullCrop: CropRegion = {
    x: 0,
    y: 0,
    width: video.media.metadata.width,
    height: video.media.metadata.height,
  }
  const initialStartMs = Math.min(
    duration,
    Math.max(0, Math.round(requestedInitialRange?.startMs ?? 0)),
  )
  const initialEndMs = Math.min(
    duration,
    Math.max(initialStartMs + 100, Math.round(requestedInitialRange?.endMs ?? duration)),
  )
  const initialCropNormalized = pixelToNormalizedCrop(
    requestedInitialCrop ?? fullCrop,
    video.media.metadata,
  )
  const initialCropMode: CropMode = initialPerspectiveCrop ? 'perspective' : 'rect'
  const initialCorners = initialPerspectiveCrop?.corners ?? rectToCorners(initialCropNormalized)
  const initialAspectRatioMode = initialPerspectiveCrop?.aspectRatio.mode ?? '16:9'
  const initialAspectRatio = initialPerspectiveCrop?.aspectRatio.value ?? 16 / 9
  const videoSource = useVideoSourceUrl(video.media.path)
  const videoRef = useRef<HTMLVideoElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const titleEditOriginalRef = useRef('')
  const composingTitleRef = useRef(false)
  const lastTitleCompositionEndRef = useRef(0)
  const autoCropControllerRef = useRef<AbortController | null>(null)
  const initialAutoCropStartedRef = useRef(false)
  const [initialRange] = useState<RangeDraft>(() => ({
    id: crypto.randomUUID(),
    title: initialTitle?.trim() || `${video.title} 1`,
    start: formatRangeInput(initialStartMs),
    end: formatRangeInput(initialEndMs),
  }))
  const [rows, setRows] = useState<RangeDraft[]>(() => [initialRange])
  const [draft, setDraft] = useState<RangeDraft>(() => initialRange)
  const [cropRegion, setCropRegion] = useState<NormalizedCropRegion>(() => initialCropNormalized)
  const [cropMode, setCropMode] = useState<CropMode>(initialCropMode)
  const [cropCorners, setCropCorners] = useState<PerspectiveCorners>(() => initialCorners)
  const [selectedCorner, setSelectedCorner] =
    useState<(typeof CORNER_GRID_ORDER)[number]>('topLeft')
  const [isZoomed, setIsZoomed] = useState(false)
  const [aspectRatioMode, setAspectRatioMode] =
    useState<PerspectiveCrop['aspectRatio']['mode']>(initialAspectRatioMode)
  const [aspectRatio, setAspectRatio] = useState(initialAspectRatio)
  const [isDetecting, setIsDetecting] = useState(false)
  const [autoCropProgress, setAutoCropProgress] = useState<AutoCropProgress | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(0)
  const [editingTitleIndex, setEditingTitleIndex] = useState<number | null>(null)
  const [draggingHandle, setDraggingHandle] = useState<TrimHandle | null>(null)
  const [resetSnapshot, setResetSnapshot] = useState<CropSnapshot>({
    start: initialRange.start,
    end: initialRange.end,
    crop: initialCropNormalized,
    cropMode: initialCropMode,
    cropCorners: cloneCorners(initialCorners),
    aspectRatioMode: initialAspectRatioMode,
    aspectRatio: initialAspectRatio,
  })
  const { refreshRangeThumbnail, removeRangeThumbnail, scheduleRangeThumbnail } =
    useRangeThumbnails({ projectId, video, rows, setRows })

  useEffect(
    () => () => {
      autoCropControllerRef.current?.abort()
      autoCropControllerRef.current = null
    },
    [],
  )

  const latestRangeEnd = (sourceRows: RangeDraft[]) =>
    sourceRows.reduce((latest, row) => {
      const endMs = parseTime(row.end, duration)
      return Number.isFinite(endMs) ? Math.max(latest, Math.min(duration, endMs)) : latest
    }, 0)

  const activePerspectiveCrop: PerspectiveCrop | undefined =
    cropMode === 'perspective'
      ? {
          corners: cropCorners,
          aspectRatio: { mode: aspectRatioMode, value: aspectRatio },
          transformVersion: 1,
        }
      : undefined

  const saveRangeValues = (nextStartMs: number, nextEndMs: number) => {
    if (editingIndex === null) return
    const existingRow = rows[editingIndex]
    if (!existingRow) return
    const nextStart = formatRangeInput(nextStartMs)
    const nextEnd = formatRangeInput(nextEndMs)
    const nextRow = { ...existingRow, start: nextStart, end: nextEnd }
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === editingIndex ? nextRow : row)),
    )
    setDraft((current) => ({ ...current, start: nextStart, end: nextEnd }))
    setError(null)
    scheduleRangeThumbnail(
      nextRow.id,
      nextStartMs,
      normalizedToPixelCrop(cropRegion, video.media.metadata),
      activePerspectiveCrop,
    )
  }

  const saveCropSelection = useCallback(
    (
      nextRegion: NormalizedCropRegion,
      nextCorners: PerspectiveCorners = cropCorners,
      nextMode: CropMode = cropMode,
      nextAspectRatioMode = aspectRatioMode,
      nextAspectRatio = aspectRatio,
    ) => {
      const nextCrop = normalizedToPixelCrop(nextRegion, video.media.metadata)
      const nextPerspectiveCrop: PerspectiveCrop | undefined =
        nextMode === 'perspective'
          ? {
              corners: cloneCorners(nextCorners),
              aspectRatio: { mode: nextAspectRatioMode, value: nextAspectRatio },
              transformVersion: 1,
            }
          : undefined
      setCropRegion(nextRegion)
      setCropCorners(nextCorners)
      setCropMode(nextMode)
      setAspectRatioMode(nextAspectRatioMode)
      setAspectRatio(nextAspectRatio)
      rows.forEach((row) => {
        scheduleRangeThumbnail(row.id, parseTime(row.start, 0), nextCrop, nextPerspectiveCrop)
      })
      setError(null)
    },
    [
      aspectRatio,
      aspectRatioMode,
      cropCorners,
      cropMode,
      rows,
      scheduleRangeThumbnail,
      video.media.metadata,
    ],
  )

  const handleCropModeChange = (nextMode: CropMode) => {
    if (nextMode === cropMode) return
    const nextRegion = nextMode === 'rect' ? cornersToRegion(cropCorners) : cropRegion
    const nextCorners = nextMode === 'perspective' ? rectToCorners(cropRegion) : cropCorners
    saveCropSelection(nextRegion, nextCorners, nextMode)
    if (nextMode === 'rect') setIsZoomed(false)
  }

  const handleAspectRatioChange = (nextMode: PerspectiveCrop['aspectRatio']['mode']) => {
    const nextAspectRatio =
      nextMode === '16:9'
        ? 16 / 9
        : nextMode === '4:3'
          ? 4 / 3
          : nextMode === 'estimated'
            ? estimatedAspectRatio(cropCorners)
            : aspectRatio
    saveCropSelection(cropRegion, cropCorners, 'perspective', nextMode, nextAspectRatio)
  }

  const handleCornerChange = (nextCorners: PerspectiveCorners) => {
    saveCropSelection(cornersToRegion(nextCorners), nextCorners, 'perspective')
  }

  const handleCornerCoordinateChange = (
    corner: (typeof CORNER_GRID_ORDER)[number],
    axis: 'x' | 'y',
    value: number,
  ) => {
    if (!Number.isFinite(value)) return
    const nextCorners = {
      ...cropCorners,
      [corner]: {
        ...cropCorners[corner],
        [axis]: Math.min(
          Math.max(
            value / (axis === 'x' ? video.media.metadata.width : video.media.metadata.height),
            0.005,
          ),
          0.995,
        ),
      },
    }
    handleCornerChange(nextCorners)
  }

  const handleAutomaticCrop = useCallback(async () => {
    if (autoCropControllerRef.current || !video.media.path) return
    setIsDetecting(true)
    setAutoCropProgress(null)
    setError(null)
    const controller = new AbortController()
    autoCropControllerRef.current = controller
    try {
      const result = await detectAutomaticCrop({
        projectId,
        path: video.media.path,
        metadata: video.media.metadata,
        signal: controller.signal,
        onProgress: setAutoCropProgress,
      })
      if (!result) {
        setError('スライド領域を自動検出できませんでした。手動で指定してください。')
        return
      }
      const nextRegion = pixelToNormalizedCrop(result.crop, video.media.metadata)
      const nextCorners = cropMode === 'perspective' ? result.corners : rectToCorners(nextRegion)
      const nextAspectRatio =
        cropMode === 'perspective' && aspectRatioMode === 'estimated'
          ? estimatedAspectRatio(nextCorners)
          : aspectRatio
      saveCropSelection(nextRegion, nextCorners, cropMode, aspectRatioMode, nextAspectRatio)
    } catch (cause) {
      if (!controller.signal.aborted) {
        console.error('スライド領域の自動検出に失敗しました。', cause)
        setError(
          `スライド領域の自動検出に失敗しました。${getErrorDetail(cause, '手動で指定してください。')}`,
        )
      }
    } finally {
      if (autoCropControllerRef.current === controller) autoCropControllerRef.current = null
      setIsDetecting(false)
      setAutoCropProgress(null)
    }
  }, [
    aspectRatio,
    aspectRatioMode,
    cropMode,
    projectId,
    saveCropSelection,
    video.media.metadata,
    video.media.path,
  ])

  useEffect(() => {
    if (!autoCropOnOpen || initialAutoCropStartedRef.current || !video.media.path) return
    initialAutoCropStartedRef.current = true
    void handleAutomaticCrop()
  }, [autoCropOnOpen, handleAutomaticCrop, video.media.path])

  const seekTo = (timeMs: number) => {
    const nextTime = Math.min(duration, Math.max(0, timeMs))
    setCurrentTime(nextTime)
    if (videoRef.current) videoRef.current.currentTime = nextTime / 1000
  }

  const parsedStartMs = parseTime(draft.start, 0)
  const parsedEndMs = parseTime(draft.end, duration)
  const startMs = Math.min(
    duration,
    Math.max(0, Number.isFinite(parsedStartMs) ? parsedStartMs : 0),
  )
  const endMs = Math.min(
    duration,
    Math.max(startMs + 100, Number.isFinite(parsedEndMs) ? parsedEndMs : duration),
  )

  const updateStart = (value: number) => {
    const parsedEnd = parseTime(draft.end, duration)
    const end = Number.isFinite(parsedEnd) ? parsedEnd : duration
    const nextStart = Math.min(Math.max(0, value), Math.max(0, end - 100))
    saveRangeValues(nextStart, end)
    seekTo(nextStart)
  }

  const updateEnd = (value: number) => {
    const parsedStart = parseTime(draft.start, 0)
    const start = Number.isFinite(parsedStart) ? parsedStart : 0
    const nextEnd = Math.min(duration, Math.max(value, start + 100))
    saveRangeValues(start, nextEnd)
    seekTo(nextEnd)
  }

  const timestampAtClientX = (clientX: number) => {
    const bounds = timelineRef.current?.getBoundingClientRect()
    if (!bounds || bounds.width === 0 || duration <= 0) return null
    const ratio = Math.min(Math.max((clientX - bounds.left) / bounds.width, 0), 1)
    return Math.round((ratio * duration) / 100) * 100
  }

  const moveHandle = (handle: TrimHandle, clientX: number) => {
    const timestampMs = timestampAtClientX(clientX)
    if (timestampMs === null) return
    if (handle === 'start') updateStart(timestampMs)
    else updateEnd(timestampMs)
  }

  const togglePlayback = () => {
    const element = videoRef.current
    if (!element) return
    if (element.paused) {
      const playbackTimeMs = element.currentTime * 1000
      if (playbackTimeMs < startMs || playbackTimeMs >= endMs) {
        element.currentTime = startMs / 1000
        setCurrentTime(startMs)
      }
      void element.play().catch((playError) => {
        console.warn('動画を再生できませんでした', playError)
      })
      setIsPlaying(true)
    } else {
      element.pause()
      setIsPlaying(false)
    }
  }

  const startHandleDrag = (event: PointerEvent<HTMLButtonElement>, handle: TrimHandle) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setDraggingHandle(handle)
    if (isPlaying) togglePlayback()
    seekTo(handle === 'start' ? startMs : endMs)
  }

  const handleHandleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, handle: TrimHandle) => {
    const stepMs = event.shiftKey ? 1_000 : 100
    const currentMs = handle === 'start' ? startMs : endMs
    let nextMs: number | null = null
    if (event.key === 'ArrowLeft') nextMs = currentMs - stepMs
    if (event.key === 'ArrowRight') nextMs = currentMs + stepMs
    if (event.key === 'Home') nextMs = handle === 'start' ? 0 : startMs + 100
    if (event.key === 'End') nextMs = handle === 'end' ? duration : endMs - 100
    if (nextMs === null) return
    event.preventDefault()
    if (handle === 'start') updateStart(nextMs)
    else updateEnd(nextMs)
  }

  const buildDraftRow = (existingRow: RangeDraft, index: number) => {
    const startMs = parseTime(draft.start, 0)
    const endMs = parseTime(draft.end, duration)
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      setError('開始と終了の時間区間を確認してください。')
      return null
    }
    const nextRow = {
      id: existingRow.id,
      title: draft.title.trim() || existingRow.title || `${video.title} ${index + 1}`,
      start: formatRangeInput(startMs),
      end: formatRangeInput(endMs),
      thumbnailPath: existingRow.thumbnailPath,
      thumbnailVersion: existingRow.thumbnailVersion,
    }
    return { row: nextRow, startMs }
  }

  const hasResetChanges = () =>
    draft.start !== resetSnapshot.start ||
    draft.end !== resetSnapshot.end ||
    !sameCrop(cropRegion, resetSnapshot.crop) ||
    cropMode !== resetSnapshot.cropMode ||
    !sameCorners(cropCorners, resetSnapshot.cropCorners) ||
    aspectRatioMode !== resetSnapshot.aspectRatioMode ||
    aspectRatio !== resetSnapshot.aspectRatio

  const createNextRange = (sourceRows: RangeDraft[]) => {
    const startMs = Math.min(latestRangeEnd(sourceRows), Math.max(0, duration - 100))
    return {
      id: crypto.randomUUID(),
      title: `${video.title} ${sourceRows.length + 1}`,
      start: formatRangeInput(startMs),
      end: formatRangeInput(duration),
    }
  }

  const addRange = () => {
    if (editingIndex === null) return
    const existingRow = rows[editingIndex]
    if (!existingRow) return
    const currentResult = buildDraftRow(existingRow, editingIndex)
    if (!currentResult) return
    const savedRows = rows.map((row, rowIndex) =>
      rowIndex === editingIndex ? currentResult.row : row,
    )
    const nextRow = createNextRange(savedRows)
    const nextRows = [...savedRows, nextRow]
    const nextIndex = nextRows.length - 1
    setRows(nextRows)
    setEditingIndex(nextIndex)
    setEditingTitleIndex(null)
    setDraft(nextRow)
    setResetSnapshot({
      start: nextRow.start,
      end: nextRow.end,
      crop: cropRegion,
      cropMode,
      cropCorners: cloneCorners(cropCorners),
      aspectRatioMode,
      aspectRatio,
    })
    setError(null)
    seekTo(parseTime(nextRow.start, 0))
    void refreshRangeThumbnail(
      currentResult.row.id,
      currentResult.startMs,
      normalizedToPixelCrop(cropRegion, video.media.metadata),
      activePerspectiveCrop,
    )
    void refreshRangeThumbnail(
      nextRow.id,
      parseTime(nextRow.start, 0),
      normalizedToPixelCrop(cropRegion, video.media.metadata),
      activePerspectiveCrop,
    )
  }

  const editRange = (index: number) => {
    const row = rows[index]
    if (!row) return
    setDraft(row)
    setEditingIndex(index)
    setEditingTitleIndex(null)
    setResetSnapshot({
      start: row.start,
      end: row.end,
      crop: cropRegion,
      cropMode,
      cropCorners: cloneCorners(cropCorners),
      aspectRatioMode,
      aspectRatio,
    })
    setError(null)
    seekTo(parseTime(row.start, 0))
  }

  const beginTitleEdit = (index: number) => {
    const row = rows[index]
    if (!row) return
    editRange(index)
    titleEditOriginalRef.current = row.title
    setEditingTitleIndex(index)
    requestAnimationFrame(() => {
      titleInputRef.current?.focus({ preventScroll: true })
      titleInputRef.current?.select()
    })
  }

  const updateInlineTitle = (index: number, title: string) => {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, title } : row)),
    )
    if (editingIndex === index) setDraft((current) => ({ ...current, title }))
  }

  const finishTitleEdit = (index: number) => {
    const row = rows[index]
    if (!row) return
    updateInlineTitle(index, row.title.trim() || `${video.title} ${index + 1}`)
    setEditingTitleIndex(null)
  }

  const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    const recentlyComposed = Date.now() - lastTitleCompositionEndRef.current < 120
    if (
      event.nativeEvent.isComposing ||
      composingTitleRef.current ||
      event.keyCode === 229 ||
      recentlyComposed
    )
      return
    if (event.key === 'Enter') {
      event.preventDefault()
      finishTitleEdit(index)
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      updateInlineTitle(index, titleEditOriginalRef.current)
      setEditingTitleIndex(null)
    }
  }

  const handleTitleBlur = (index: number) => {
    if (composingTitleRef.current || Date.now() - lastTitleCompositionEndRef.current < 120) return
    finishTitleEdit(index)
  }

  const removeRange = (index: number) => {
    if (rows.length <= 1) return
    const removedRow = rows[index]
    const nextRows = rows.filter((_, rowIndex) => rowIndex !== index)
    setRows(nextRows)
    if (editingTitleIndex === index) setEditingTitleIndex(null)
    if (removedRow) void removeRangeThumbnail(removedRow.id)
    if (editingIndex === index) {
      const nextIndex = Math.min(index, nextRows.length - 1)
      const nextRow = nextRows[nextIndex]
      setEditingIndex(nextIndex)
      setDraft(nextRow)
      setResetSnapshot({
        start: nextRow.start,
        end: nextRow.end,
        crop: cropRegion,
        cropMode,
        cropCorners: cloneCorners(cropCorners),
        aspectRatioMode,
        aspectRatio,
      })
      setError(null)
      seekTo(parseTime(nextRow.start, 0))
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex((current) => (current === null ? null : current - 1))
    }
  }

  const resetRange = () => {
    if (editingIndex === null) return
    const row = rows[editingIndex]
    if (!row) return
    const resetStartMs = parseTime(resetSnapshot.start, 0)
    const resetEndMs = parseTime(resetSnapshot.end, duration)
    if (!Number.isFinite(resetStartMs) || !Number.isFinite(resetEndMs)) return
    saveRangeValues(resetStartMs, resetEndMs)
    saveCropSelection(
      resetSnapshot.crop,
      resetSnapshot.cropCorners,
      resetSnapshot.cropMode,
      resetSnapshot.aspectRatioMode,
      resetSnapshot.aspectRatio,
    )
    setError(null)
    seekTo(resetStartMs)
  }

  const submit = async () => {
    if (rows.length === 0) {
      setError('記事にする区間を1つ以上追加してください。')
      return
    }
    let ranges: ArticleRange[]
    try {
      ranges = rows.map((row, index) => {
        const startMs = parseTime(row.start, 0)
        const endMs = parseTime(row.end, duration)
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs)
          throw new Error(`${index + 1}件目の時間区間を確認してください。`)
        return {
          title: row.title.trim() || `${video.title} ${index + 1}`,
          range: { startMs, endMs },
        }
      })
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : '開始と終了の時間区間を確認してください。',
      )
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit(
        ranges,
        normalizedToPixelCrop(cropRegion, video.media.metadata),
        activePerspectiveCrop,
      )
      onClose?.()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '区間を追加できませんでした。')
    } finally {
      setBusy(false)
    }
  }

  const startPercent = duration ? (startMs / duration) * 100 : 0
  const endPercent = duration ? (endMs / duration) * 100 : 100
  const activeRangeColor = rangeColor(editingIndex ?? rows.length)
  const timelineRanges = rows.map((row, index) => {
    const rowStart = parseTime(row.start, 0)
    const rowEnd = parseTime(row.end, duration)
    const safeStart = Number.isFinite(rowStart) ? Math.min(duration, Math.max(0, rowStart)) : 0
    const safeEnd = Number.isFinite(rowEnd) ? Math.min(duration, Math.max(0, rowEnd)) : duration
    return {
      index,
      left: duration ? (safeStart / duration) * 100 : 0,
      width: duration ? Math.max(0, ((safeEnd - safeStart) / duration) * 100) : 100,
      color: rangeColor(index),
    }
  })
  const activePixelCrop = normalizedToPixelCrop(
    cropMode === 'perspective' ? cornersToRegion(cropCorners) : cropRegion,
    video.media.metadata,
  )
  const previewAspectRatio =
    cropMode === 'perspective'
      ? aspectRatio
      : activePixelCrop.width / Math.max(activePixelCrop.height, 1)

  return {
    duration,
    videoSource,
    videoRef,
    timelineRef,
    titleInputRef,
    rows,
    draft,
    cropRegion,
    cropMode,
    cropCorners,
    selectedCorner,
    isZoomed,
    aspectRatioMode,
    aspectRatio,
    isDetecting,
    autoCropProgress,
    currentTime,
    isPlaying,
    busy,
    error,
    editingIndex,
    editingTitleIndex,
    draggingHandle,
    startMs,
    endMs,
    startPercent,
    endPercent,
    activeRangeColor,
    timelineRanges,
    activePixelCrop,
    activePerspectiveCrop,
    previewAspectRatio,
    setSelectedCorner,
    setIsZoomed,
    setIsPlaying,
    setCurrentTime,
    setError,
    setEditingTitleIndex,
    setComposingTitle: (value: boolean) => {
      composingTitleRef.current = value
    },
    setLastTitleCompositionEnd: () => {
      lastTitleCompositionEndRef.current = Date.now()
    },
    handleCropModeChange,
    handleAspectRatioChange,
    handleCornerChange,
    handleCornerCoordinateChange,
    handleAutomaticCrop,
    saveCropSelection,
    togglePlayback,
    timestampAtClientX,
    moveHandle,
    startHandleDrag,
    handleHandleKeyDown,
    setDraggingHandle,
    handleTitleKeyDown,
    handleTitleBlur,
    beginTitleEdit,
    finishTitleEdit,
    updateInlineTitle,
    addRange,
    editRange,
    removeRange,
    resetRange,
    hasResetChanges,
    submit,
  }
}

export type ArticleRangeEditor = ReturnType<typeof useArticleRangeEditor>
