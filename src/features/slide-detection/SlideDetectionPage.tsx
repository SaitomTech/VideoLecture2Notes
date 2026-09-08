import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { AppHeader } from '../../components/AppHeader'
import { WorkflowBar } from '../../components/WorkflowBar'
import type { WorkflowStep } from '../../lib/workflow'
import { getActiveMediaSource, type MediaProject, type SlideBoundary } from '../../types/project'
import { useSlideDetection } from './hooks/useSlideDetection'
import { buildSlideData } from './detection'
import { SlideDetectionResultPanel } from './components/SlideDetectionResultPanel'
import { SlideDetectionSettingsStatus } from './components/SlideDetectionSettingsStatus'
import type { SlideDetectionOutput } from './types'

type SlideDetectionPageProps = {
  project: MediaProject
  onBack: () => void
  onCompleted: (output: SlideDetectionOutput) => void | Promise<void>
  onContinue: () => void
  onHome: () => void
  maxReachedStep: WorkflowStep
  onStepClick: (step: WorkflowStep) => void
}

export function SlideDetectionPage({
  project,
  onBack,
  onCompleted,
  onContinue,
  onHome,
  maxReachedStep,
  onStepClick,
}: SlideDetectionPageProps) {
  const source = getActiveMediaSource(project)
  const durationMs = source.metadata.durationMs
  const [reviewBoundaries, setReviewBoundaries] = useState<SlideBoundary[] | null>(
    () => project.slideDetection?.boundaries ?? null,
  )
  const savedReviewBoundariesRef = useRef<SlideBoundary[] | null>(
    project.slideDetection?.boundaries ?? null,
  )
  const [threshold, setThreshold] = useState(
    project.slideDetection?.threshold ?? project.settings.slideDetection.threshold,
  )
  const [sampleIntervalMs, setSampleIntervalMs] = useState(
    project.slideDetection?.sampleIntervalMs ?? project.settings.slideDetection.sampleIntervalMs,
  )
  const [hasUnsavedReview, setHasUnsavedReview] = useState(false)
  const [isSavingReview, setIsSavingReview] = useState(false)
  const handleDetectionCompleted = useCallback(
    async (nextOutput: SlideDetectionOutput) => {
      setReviewBoundaries(nextOutput.result.boundaries)
      savedReviewBoundariesRef.current = nextOutput.result.boundaries
      setThreshold(nextOutput.result.threshold)
      setSampleIntervalMs(nextOutput.result.sampleIntervalMs)
      setHasUnsavedReview(false)
      await onCompleted(nextOutput)
    },
    [onCompleted],
  )

  const detection = useSlideDetection(project, { onCompleted: handleDetectionCompleted })
  const output = useMemo(
    () =>
      detection.output
        ? {
            result: {
              ...detection.output.result,
              boundaries: reviewBoundaries ?? detection.output.result.boundaries,
            },
            slides: buildSlideData(
              reviewBoundaries ?? detection.output.result.boundaries,
              durationMs,
              detection.output.slides,
            ),
          }
        : null,
    [detection.output, durationMs, reviewBoundaries],
  )
  const slides = output?.slides ?? []
  const boundaries = output?.result.boundaries ?? []
  const isRunning = detection.status === 'running'
  const isCompleted = detection.status === 'completed'

  const updateReviewBoundaries = useCallback((nextBoundaries: SlideBoundary[]) => {
    setReviewBoundaries(
      nextBoundaries.toSorted((first, second) => first.timestampMs - second.timestampMs),
    )
    setHasUnsavedReview(true)
  }, [])

  const saveReview = async () => {
    if (!output || !hasUnsavedReview) return
    setIsSavingReview(true)
    try {
      await onCompleted(output)
      savedReviewBoundariesRef.current = output.result.boundaries
      setHasUnsavedReview(false)
    } catch (saveError) {
      console.error(saveError)
    } finally {
      setIsSavingReview(false)
    }
  }

  const cancelReview = () => {
    setReviewBoundaries(savedReviewBoundariesRef.current)
    setHasUnsavedReview(false)
  }

  const handleDetect = () => detection.detect({ threshold, sampleIntervalMs })

  return (
    <main className="flex min-h-svh flex-col bg-[#f4f7f4] font-[Avenir_Next,Hiragino_Sans,Yu_Gothic,system-ui,sans-serif] text-[18px] leading-[1.45] tracking-[0.18px] text-[#18211f]">
      <AppHeader
        onHome={onHome}
        homeDisabled={isRunning || isSavingReview || hasUnsavedReview}
      />
      <WorkflowBar
        activeStep="detect-slides"
        maxReachedStep={maxReachedStep}
        onStepClick={onStepClick}
        disabled={isRunning || isSavingReview || hasUnsavedReview}
      />

      <section className="mx-auto flex w-[calc(100%-48px)] max-w-[1040px] flex-1 flex-col pb-12 md:w-[calc(100%-11.6vw)]">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">
              03 / DETECT SLIDES
            </p>
            <h1 className="mt-1 text-[27px] font-bold tracking-[-0.06em]">スライドを検出</h1>
            <p className="mt-1 text-xs text-[#71807b]">
              画面の変化を比較して、スライド区間を自動で分けます。
            </p>
          </div>
          <button
            className="inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-[#71807b] transition hover:bg-[#e2eee8] hover:text-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30"
            type="button"
            onClick={onBack}
          >
            <ArrowLeft size={15} strokeWidth={1.8} />
            範囲を調整
          </button>
        </div>

        <div className="overflow-hidden rounded-[18px] border border-[#b7cbc0] bg-[#fbfcfa] shadow-[0_18px_52px_rgba(22,54,42,0.07)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8e1dc] px-5 py-3.5">
            <div className="min-w-0">
              <p
                className="truncate text-xs font-semibold text-[#18211f]"
                title={source.path}
              >
                {source.name}
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-[#71807b]">
                Crop {project.crop.x}, {project.crop.y} · {project.crop.width} ×{' '}
                {project.crop.height}px
              </p>
            </div>
          </div>

          <div className="p-5 md:p-7">
            <SlideDetectionSettingsStatus
              threshold={threshold}
              sampleIntervalMs={sampleIntervalMs}
              status={detection.status}
              stage={detection.stage}
              stageProgress={detection.stageProgress}
              error={detection.error}
              isSaving={isSavingReview}
              onThresholdChange={setThreshold}
              onSampleIntervalChange={setSampleIntervalMs}
              onDetect={handleDetect}
            />

            {output && isCompleted && (
              <SlideDetectionResultPanel
                path={source.path}
                boundaries={boundaries}
                slides={slides}
                onChange={updateReviewBoundaries}
              />
            )}
          </div>

          {hasUnsavedReview && (
            <div className="flex justify-end gap-2 border-t border-[#d8e1dc] px-5 py-4">
              <button
                className="inline-flex items-center rounded-[9px] px-3 py-2.5 text-xs font-semibold text-[#71807b] transition hover:bg-[#f1f6f2] hover:text-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={cancelReview}
                disabled={isSavingReview || isRunning}
              >
                修正をキャンセル
              </button>
              <button
                className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#b7cbc0] bg-[#fbfcfa] px-3 py-2.5 text-xs font-semibold text-[#1d6b50] transition hover:border-[#1d6b50] hover:bg-[#e2eee8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={() => void saveReview()}
                disabled={isSavingReview || isRunning}
              >
                <Check size={13} />
                {isSavingReview ? '保存中…' : '修正を保存'}
              </button>
            </div>
          )}

          {output && isCompleted && !hasUnsavedReview && (
            <div className="flex justify-end border-t border-[#d8e1dc] px-5 py-4">
              <button
                className="inline-flex items-center gap-2 rounded-[9px] bg-[#1d6b50] px-4 py-3 text-xs font-semibold text-[#f3faf6] shadow-[0_7px_16px_rgba(29,107,80,0.17)] transition hover:bg-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2"
                type="button"
                onClick={onContinue}
              >
                文字起こしへ
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
