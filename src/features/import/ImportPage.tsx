import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { AppHeader } from '../../components/AppHeader'
import { WorkflowBar } from '../../components/WorkflowBar'
import { getErrorDetail } from '../../lib/errors'
import type { WorkflowStep } from '../../lib/workflow'
import { LocalVideoImportPanel } from './components/LocalVideoImportPanel'
import { SelectedVideoSummary } from './components/SelectedVideoSummary'
import { YoutubeImportPanel } from './components/YoutubeImportPanel'
import { VideoPreview } from './components/VideoPreview'
import { useVideoPicker } from './hooks/useVideoPicker'
import { useYoutubeImporter } from './hooks/useYoutubeImporter'
import type {
  SelectedVideo,
  VideoLoadStatus,
  YoutubeImportOptions,
  YoutubeImportRequest,
} from './types'
import type { YoutubeDownloadProgress } from '../../lib/youtube/types'

type ImportSource = 'file' | 'youtube'

type ImportPageProps = {
  initialVideo?: SelectedVideo
  onContinue: (video: SelectedVideo) => void | Promise<void>
  onContinueYoutube: (
    request: YoutubeImportRequest,
    options: YoutubeImportOptions,
  ) => SelectedVideo | Promise<SelectedVideo>
  onContinueYoutubeImport: () => void | Promise<void>
  onHome: () => void
  maxReachedStep: WorkflowStep
  onStepClick: (step: WorkflowStep) => void
}

export function ImportPage({
  initialVideo,
  onContinue,
  onContinueYoutube,
  onContinueYoutubeImport,
  onHome,
  maxReachedStep,
  onStepClick,
}: ImportPageProps) {
  const [activeSource, setActiveSource] = useState<ImportSource>('file')
  const [isYoutubeOpen, setIsYoutubeOpen] = useState(false)
  const [isContinuing, setIsContinuing] = useState(false)
  const [continueError, setContinueError] = useState<string | null>(null)
  const [youtubeImportError, setYoutubeImportError] = useState<string | null>(null)
  const [youtubePreviewError, setYoutubePreviewError] = useState<string | null>(null)
  const [isYoutubeImporting, setIsYoutubeImporting] = useState(false)
  const [youtubeVideo, setYoutubeVideo] = useState<SelectedVideo | null>(null)
  const [youtubeVideoStatus, setYoutubeVideoStatus] = useState<'checking' | 'ready' | 'error'>(
    'checking',
  )
  const [youtubeProgress, setYoutubeProgress] = useState<YoutubeDownloadProgress | null>(null)
  const youtubeAbortRef = useRef<AbortController | null>(null)
  const isBusy = isContinuing || isYoutubeImporting
  const handleLocalVideoSelected = useCallback(() => {
    setActiveSource('file')
    setContinueError(null)
  }, [])
  const picker = useVideoPicker(initialVideo, handleLocalVideoSelected)
  const youtube = useYoutubeImporter()

  useEffect(() => {
    return () => youtubeAbortRef.current?.abort()
  }, [])

  const handleContinue = async () => {
    if (
      !picker.selectedVideo ||
      picker.videoStatus !== 'ready' ||
      picker.metadataStatus !== 'ready'
    )
      return

    setIsContinuing(true)
    setContinueError(null)
    try {
      await onContinue(picker.selectedVideo)
    } catch (error) {
      console.error(error)
      setContinueError('プロジェクトを準備できませんでした。もう一度お試しください。')
    } finally {
      setIsContinuing(false)
    }
  }

  const handleYoutubeImport = async () => {
    if (!youtube.info || isYoutubeImporting) return

    const controller = new AbortController()
    youtubeAbortRef.current = controller
    setIsYoutubeImporting(true)
    setYoutubeVideo(null)
    setYoutubeImportError(null)
    setYoutubePreviewError(null)
    setYoutubeProgress(null)
    setContinueError(null)

    try {
      const importedVideo = await onContinueYoutube(
        {
          info: youtube.info,
          quality: youtube.quality,
        },
        {
          signal: controller.signal,
          onProgress: setYoutubeProgress,
        },
      )
      setYoutubeVideo(importedVideo)
      setYoutubeVideoStatus('checking')
      setActiveSource('youtube')
      setIsYoutubeOpen(false)
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error(error)
        setYoutubeImportError(
          getErrorDetail(error, 'YouTube動画をプロジェクトに追加できませんでした。'),
        )
      }
    } finally {
      if (youtubeAbortRef.current === controller) youtubeAbortRef.current = null
      setIsYoutubeImporting(false)
    }
  }

  const handleYoutubeCancel = () => {
    youtubeAbortRef.current?.abort()
  }

  const handleContinueYoutubeImport = async () => {
    if (!youtubeVideo || isContinuing) return

    setIsContinuing(true)
    setContinueError(null)
    try {
      await onContinueYoutubeImport()
    } catch (error) {
      console.error(error)
      setContinueError('スライド領域設定を開けませんでした。もう一度お試しください。')
    } finally {
      setIsContinuing(false)
    }
  }

  const handleYoutubeUrlChange = (value: string) => {
    setYoutubeVideo(null)
    setYoutubeImportError(null)
    setYoutubePreviewError(null)
    setContinueError(null)
    youtube.changeUrl(value)
  }

  const handleYoutubeVideoReady = () => {
    setYoutubeVideoStatus('ready')
  }

  const handleYoutubeVideoError = (message?: string) => {
    setYoutubeVideoStatus('error')
    setYoutubePreviewError(message ?? '動画は保存されましたが、プレビューを再生できませんでした。')
  }

  const previewVideo = activeSource === 'file' ? picker.selectedVideo : youtubeVideo
  const previewVideoStatus: VideoLoadStatus =
    activeSource === 'file' ? picker.videoStatus : youtubeVideoStatus
  const previewError =
    activeSource === 'file' ? picker.error || picker.metadataError : youtubePreviewError
  const canContinue =
    activeSource === 'file'
      ? Boolean(
          picker.selectedVideo &&
          picker.videoStatus === 'ready' &&
          picker.metadataStatus === 'ready',
        )
      : Boolean(youtubeVideo)

  return (
    <main className="flex min-h-svh flex-col bg-[#f4f7f4] font-[Avenir_Next,Hiragino_Sans,Yu_Gothic,system-ui,sans-serif] text-[18px] leading-[1.45] tracking-[0.18px] text-[#18211f]">
      <AppHeader onHome={onHome} homeDisabled={isBusy} />
      <WorkflowBar
        activeStep="import"
        maxReachedStep={maxReachedStep}
        onStepClick={onStepClick}
        disabled={isBusy}
      />

      <section className="mx-auto flex w-[calc(100%-48px)] max-w-[1040px] flex-1 flex-col pb-12 md:w-[calc(100%-11.6vw)]">
        <div className="w-full">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">
                01 / IMPORT
              </p>
              <h1 className="mt-1 text-[27px] font-bold tracking-[-0.06em]">動画を読み込む</h1>
              <p className="mt-1 text-xs text-[#71807b]">
                動画ファイルを選択するか、YouTubeから動画データをダウンロードします。
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-[18px] border border-[#b7cbc0] bg-[#fbfcfa] shadow-[0_18px_52px_rgba(22,54,42,0.07)]">
            <div className="p-5 sm:p-7">
              {activeSource === 'youtube' && youtubeVideo ? (
                <SelectedVideoSummary
                  video={youtubeVideo}
                  disabled={isBusy}
                  isSelecting={picker.isSelecting}
                  onChoose={picker.chooseVideo}
                />
              ) : (
                <LocalVideoImportPanel picker={picker} disabled={isBusy} />
              )}

              <section className="mt-7 rounded-[14px] bg-[#eef5f0] p-4 sm:p-5">
                <button
                  className="flex w-full items-center justify-between gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25 focus-visible:ring-offset-2"
                  type="button"
                  aria-expanded={isYoutubeOpen}
                  onClick={() => setIsYoutubeOpen((open) => !open)}
                  disabled={isBusy}
                >
                  <span className="text-xs font-semibold tracking-[-0.01em] text-[#53615b]">
                    YouTubeからダウンロード
                  </span>
                  <ChevronDown
                    size={18}
                    className={`text-[#1d6b50] transition-transform duration-200 ${isYoutubeOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>
                {isYoutubeOpen && (
                  <div className="mt-4">
                    <YoutubeImportPanel
                      url={youtube.url}
                      info={youtube.info}
                      status={youtube.status}
                      error={youtube.error}
                      quality={youtube.quality}
                      isImporting={isYoutubeImporting}
                      isImportComplete={Boolean(youtubeVideo)}
                      isContinuing={isContinuing}
                      progress={youtubeProgress}
                      importError={youtubeImportError}
                      onUrlChange={handleYoutubeUrlChange}
                      onResolve={youtube.resolve}
                      onQualityChange={youtube.setQuality}
                      onImport={handleYoutubeImport}
                      onCancel={handleYoutubeCancel}
                    />
                  </div>
                )}
              </section>
            </div>

            <div className="mx-auto w-full max-w-[720px] px-5 pb-5 sm:px-7 sm:pb-7">
              {previewVideo ? (
                <div>
                  <VideoPreview
                    video={previewVideo}
                    videoStatus={previewVideoStatus}
                    onVideoReady={
                      activeSource === 'file' ? picker.handleVideoReady : handleYoutubeVideoReady
                    }
                    onVideoError={
                      activeSource === 'file' ? picker.handleVideoError : handleYoutubeVideoError
                    }
                  />
                  {previewError && <p className="mt-3 text-xs text-[#b6533a]">{previewError}</p>}
                </div>
              ) : (
                <div className="grid min-h-[180px] place-items-center rounded-[12px] border border-dashed border-[#b7cbc0] bg-[#f7faf7] px-6 text-center">
                  <p className="max-w-[360px] text-xs leading-5 text-[#9aa6a1]">
                    {activeSource === 'file'
                      ? '動画ファイルを読み込むと、ここにプレビューが表示されます。'
                      : 'YouTube動画の読み込みが完了すると、ここにプレビューが表示されます。'}
                  </p>
                </div>
              )}
            </div>

            <footer className="px-5 pb-5 sm:px-7 sm:pb-7">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  {continueError && <p className="mt-1 text-xs text-[#b6533a]">{continueError}</p>}
                </div>
                <button
                  className="inline-flex items-center gap-[18px] rounded-[9px] bg-[#1d6b50] px-5 py-3.5 text-xs font-semibold text-[#f3faf6] shadow-[0_7px_16px_rgba(29,107,80,0.17)] transition hover:-translate-y-0.5 hover:bg-[#174d3c] hover:shadow-[0_9px_20px_rgba(29,107,80,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none"
                  type="button"
                  onClick={() =>
                    void (activeSource === 'file'
                      ? handleContinue()
                      : handleContinueYoutubeImport())
                  }
                  disabled={!canContinue || isBusy}
                >
                  <span>{isContinuing ? '準備中…' : 'スライド領域を設定'}</span>
                  <span className="text-[17px] font-normal leading-none" aria-hidden="true">
                    →
                  </span>
                </button>
              </div>
            </footer>
          </div>
        </div>
      </section>
    </main>
  )
}
