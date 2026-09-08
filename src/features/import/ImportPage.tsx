import { useEffect, useRef, useState } from 'react'
import { AppHeader } from '../../components/AppHeader'
import { WorkflowBar } from '../../components/WorkflowBar'
import type { WorkflowStep } from '../../lib/workflow'
import { ImportModeTabs } from './components/ImportModeTabs'
import { LocalVideoImportPanel } from './components/LocalVideoImportPanel'
import { YoutubeImportPanel } from './components/YoutubeImportPanel'
import { useVideoPicker } from './hooks/useVideoPicker'
import { useYoutubeImporter } from './hooks/useYoutubeImporter'
import type { SelectedVideo, YoutubeImportOptions, YoutubeImportRequest } from './types'
import type { YoutubeDownloadProgress } from '../../lib/youtube/types'

type ImportMode = 'file' | 'youtube'

type ImportPageProps = {
  initialVideo?: SelectedVideo
  onContinue: (video: SelectedVideo) => void | Promise<void>
  onContinueYoutube: (
    request: YoutubeImportRequest,
    options: YoutubeImportOptions,
  ) => void | Promise<void>
  onHome: () => void
  maxReachedStep: WorkflowStep
  onStepClick: (step: WorkflowStep) => void
}

export function ImportPage({
  initialVideo,
  onContinue,
  onContinueYoutube,
  onHome,
  maxReachedStep,
  onStepClick,
}: ImportPageProps) {
  const picker = useVideoPicker(initialVideo)
  const youtube = useYoutubeImporter()
  const [mode, setMode] = useState<ImportMode>('file')
  const [isContinuing, setIsContinuing] = useState(false)
  const [continueError, setContinueError] = useState<string | null>(null)
  const [isYoutubeImporting, setIsYoutubeImporting] = useState(false)
  const [youtubeProgress, setYoutubeProgress] = useState<YoutubeDownloadProgress | null>(null)
  const youtubeAbortRef = useRef<AbortController | null>(null)

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
    setYoutubeProgress(null)
    setContinueError(null)

    try {
      await onContinueYoutube(
        {
          info: youtube.info,
          quality: youtube.quality,
        },
        {
          signal: controller.signal,
          onProgress: setYoutubeProgress,
        },
      )
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error(error)
        setContinueError(
          error instanceof Error
            ? error.message
            : 'YouTube動画をプロジェクトに追加できませんでした。',
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

  const handleModeChange = (nextMode: ImportMode) => {
    setMode(nextMode)
    setContinueError(null)
  }

  return (
    <main className="flex min-h-svh flex-col bg-[#f4f7f4] font-[Avenir_Next,Hiragino_Sans,Yu_Gothic,system-ui,sans-serif] text-[18px] leading-[1.45] tracking-[0.18px] text-[#18211f]">
      <AppHeader onHome={onHome} homeDisabled={isContinuing || isYoutubeImporting} />
      <WorkflowBar
        activeStep="import"
        maxReachedStep={maxReachedStep}
        onStepClick={onStepClick}
        disabled={isContinuing || isYoutubeImporting}
      />

      <section className="mx-auto flex min-h-[540px] w-[calc(100%-48px)] max-w-[1040px] flex-1 items-start justify-center pt-10 md:w-[calc(100%-11.6vw)] md:pt-14">
        <div className="w-full max-w-[720px]">
          <ImportModeTabs
            mode={mode}
            disabled={isContinuing || isYoutubeImporting}
            onChange={handleModeChange}
          />

          {mode === 'youtube' ? (
            <YoutubeImportPanel
              url={youtube.url}
              info={youtube.info}
              status={youtube.status}
              error={youtube.error}
              quality={youtube.quality}
              isImporting={isYoutubeImporting}
              progress={youtubeProgress}
              externalError={continueError}
              onUrlChange={youtube.changeUrl}
              onResolve={youtube.resolve}
              onQualityChange={youtube.setQuality}
              onImport={handleYoutubeImport}
              onCancel={handleYoutubeCancel}
            />
          ) : (
            <LocalVideoImportPanel
              picker={picker}
              isContinuing={isContinuing}
              continueError={continueError}
              onContinue={handleContinue}
            />
          )}
        </div>
      </section>
    </main>
  )
}
