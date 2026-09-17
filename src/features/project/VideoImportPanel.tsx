import { LoaderCircle } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { YoutubeDownloadModal } from '../import/components/YoutubeDownloadModal'
import { YoutubeImportPanel } from '../import/components/YoutubeImportPanel'
import { SelectedVideoSummary } from '../import/components/SelectedVideoSummary'
import { VideoDropZone } from '../import/components/VideoDropZone'
import { VideoPreview } from '../import/components/VideoPreview'
import { useVideoPicker } from '../import/hooks/useVideoPicker'
import { useYoutubeImporter } from '../import/hooks/useYoutubeImporter'
import { getErrorDetail } from '../../lib/errors'
import type { SelectedVideo, YoutubeImportOptions, YoutubeImportRequest } from '../import/types'
import type { YoutubeDownloadProgress } from '../../lib/youtube/types'
import type { ProjectVideo } from '../../types/project'

type VideoImportPanelProps = {
  onAddLocalVideo: (video: SelectedVideo) => Promise<ProjectVideo>
  onAddYoutubeVideo: (
    request: YoutubeImportRequest,
    options: YoutubeImportOptions,
  ) => Promise<ProjectVideo>
  onVideoAdded?: (video: ProjectVideo) => void
  continueToPreparation?: boolean
  primaryActionLabel?: string
}

export type VideoImportSource = 'finder' | 'youtube'

export type VideoImportPanelHandle = {
  openFinder: () => Promise<void>
  openYoutube: () => void
}

export const VideoImportPanel = forwardRef<VideoImportPanelHandle, VideoImportPanelProps>(
  function VideoImportPanel(
    { onAddLocalVideo, onAddYoutubeVideo, onVideoAdded, continueToPreparation, primaryActionLabel },
    ref,
  ) {
    const picker = useVideoPicker()
    const youtube = useYoutubeImporter()
    const youtubeAbortRef = useRef<AbortController | null>(null)
    const [youtubeOpen, setYoutubeOpen] = useState(false)
    const [isAddingLocal, setIsAddingLocal] = useState(false)
    const [localError, setLocalError] = useState<string | null>(null)
    const [localSuccess, setLocalSuccess] = useState<string | null>(null)
    const [isYoutubeImporting, setIsYoutubeImporting] = useState(false)
    const [isYoutubeImportComplete, setIsYoutubeImportComplete] = useState(false)
    const [youtubeProgress, setYoutubeProgress] = useState<YoutubeDownloadProgress | null>(null)
    const [youtubeError, setYoutubeError] = useState<string | null>(null)

    useEffect(() => {
      return () => youtubeAbortRef.current?.abort()
    }, [])

    useImperativeHandle(
      ref,
      () => ({
        openFinder: picker.chooseVideo,
        openYoutube: () => setYoutubeOpen(true),
      }),
      [picker.chooseVideo],
    )

    const handleLocalAdd = async () => {
      if (
        !picker.selectedVideo ||
        picker.videoStatus !== 'ready' ||
        picker.metadataStatus !== 'ready' ||
        isAddingLocal
      )
        return

      setIsAddingLocal(true)
      setLocalError(null)
      setLocalSuccess(null)
      try {
        const added = await onAddLocalVideo(picker.selectedVideo)
        picker.clearVideo()
        onVideoAdded?.(added)
        setLocalSuccess('動画をプロジェクトへ追加しました。')
      } catch (error) {
        console.error(error)
        setLocalError(error instanceof Error ? error.message : '動画を追加できませんでした。')
      } finally {
        setIsAddingLocal(false)
      }
    }

    const handleYoutubeImport = async (request: YoutubeImportRequest) => {
      if (isYoutubeImporting) return
      const controller = new AbortController()
      youtubeAbortRef.current = controller
      setIsYoutubeImporting(true)
      setIsYoutubeImportComplete(false)
      setYoutubeProgress(null)
      setYoutubeError(null)

      try {
        const added = await onAddYoutubeVideo(request, {
          signal: controller.signal,
          onProgress: setYoutubeProgress,
        })
        onVideoAdded?.(added)
        setIsYoutubeImportComplete(true)
        closeYoutube(true)
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error)
          setYoutubeError(getErrorDetail(error, 'YouTube動画を追加できませんでした。'))
        }
      } finally {
        if (youtubeAbortRef.current === controller) youtubeAbortRef.current = null
        setIsYoutubeImporting(false)
      }
    }

    const closeYoutube = (force = false) => {
      if (isYoutubeImporting && !force) return
      youtube.reset()
      setYoutubeOpen(false)
      setIsYoutubeImportComplete(false)
      setYoutubeProgress(null)
      setYoutubeError(null)
    }

    return (
      <>
        <VideoDropZone
          isDragging={picker.isDragging}
          onChoose={picker.chooseVideo}
          onYoutubeClick={() => setYoutubeOpen(true)}
        />

        {(picker.error || picker.metadataError || localError) && (
          <p className="mt-3 text-xs text-[#b6533a]" role="alert">
            {picker.error || picker.metadataError || localError}
          </p>
        )}
        {localSuccess && <p className="mt-3 text-xs text-[#1d6b50]">{localSuccess}</p>}

        {picker.selectedVideo && (
          <YoutubeDownloadModal
            title="動画を追加"
            description="動画情報を確認して、プロジェクトへ追加します。"
            closeLabel="動画追加を閉じる"
            closeDisabled={isAddingLocal}
            onClose={() => {
              if (isAddingLocal) return
              picker.clearVideo()
            }}
          >
            <VideoPreview
              video={picker.selectedVideo}
              videoStatus={picker.videoStatus}
              isDragging={picker.isDragging}
              isSelecting={picker.isSelecting}
              onChoose={picker.chooseVideo}
              onVideoReady={picker.handleVideoReady}
              onVideoError={picker.handleVideoError}
            />
            <SelectedVideoSummary
              video={picker.selectedVideo}
              videoStatus={picker.videoStatus}
              metadataStatus={picker.metadataStatus}
            />
            <button
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[9px] bg-[#1d6b50] px-4 py-3 text-xs font-semibold text-[#f3faf6] shadow-[0_7px_16px_rgba(29,107,80,0.17)] transition hover:bg-[#174d3c] disabled:cursor-not-allowed disabled:opacity-40"
              type="button"
              onClick={() => void handleLocalAdd()}
              disabled={
                picker.isSelecting ||
                isAddingLocal ||
                picker.videoStatus !== 'ready' ||
                picker.metadataStatus !== 'ready'
              }
            >
              {isAddingLocal && <LoaderCircle className="animate-spin" size={14} />}
              {isAddingLocal
                ? '準備中…'
                : (primaryActionLabel ??
                  (continueToPreparation ? '追加して記事の範囲を指定' : 'この動画を追加'))}
            </button>
          </YoutubeDownloadModal>
        )}

        {youtubeOpen && (
          <YoutubeDownloadModal closeDisabled={isYoutubeImporting} onClose={closeYoutube}>
            <YoutubeImportPanel
              url={youtube.url}
              info={youtube.info}
              status={youtube.status}
              error={youtube.error}
              quality={youtube.quality}
              isImporting={isYoutubeImporting}
              isImportComplete={isYoutubeImportComplete}
              isContinuing={false}
              progress={youtubeProgress}
              externalError={youtubeError}
              onUrlChange={(value) => {
                setYoutubeError(null)
                youtube.changeUrl(value)
              }}
              onResolve={youtube.resolve}
              onQualityChange={youtube.setQuality}
              onImport={() => {
                if (!youtube.info) return
                return handleYoutubeImport({ info: youtube.info, quality: youtube.quality })
              }}
              onContinue={closeYoutube}
              onCancel={() => youtubeAbortRef.current?.abort()}
              continueLabel="プロジェクト詳細へ戻る"
              importLabel={
                primaryActionLabel ??
                (continueToPreparation ? '追加して記事の範囲を指定' : 'この動画を追加')
              }
              showHeader={false}
            />
          </YoutubeDownloadModal>
        )}
      </>
    )
  },
)
