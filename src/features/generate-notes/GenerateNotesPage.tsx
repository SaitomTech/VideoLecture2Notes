import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { AppHeader } from '../../components/AppHeader'
import { WorkflowBar } from '../../components/WorkflowBar'
import type { MediaProject, TranscriptionResult } from '../../types/project'
import { CorrectionPanel } from '../correction/components/CorrectionPanel'
import { useCorrection } from '../correction/hooks/useCorrection'
import type { CorrectionSlideCompleted } from '../correction/correction'
import { OcrPanel } from '../ocr/components/OcrPanel'
import { useOcr } from '../ocr/hooks/useOcr'
import type { OcrSlideCompleted } from '../ocr/ocr'
import { TranscriptionSettings } from './components/TranscriptionSettings'
import { TranscriptionStatus } from './components/TranscriptionStatus'
import { TranscriptPreview } from './components/TranscriptPreview'
import { useTranscription } from './hooks/useTranscription'
import type { TranscriptionLanguage } from './transcription'

type GenerateNotesPageProps = {
  project: MediaProject
  onBack: () => void
  onCompleted: (result: TranscriptionResult) => void | Promise<void>
  onOcrSlideCompleted: OcrSlideCompleted
  onCorrectionSlideCompleted: CorrectionSlideCompleted
}

export function GenerateNotesPage({
  project,
  onBack,
  onCompleted,
  onOcrSlideCompleted,
  onCorrectionSlideCompleted,
}: GenerateNotesPageProps) {
  const [language, setLanguage] = useState<TranscriptionLanguage>(
    project.transcription?.language === 'ja' || project.transcription?.language === 'en'
      ? project.transcription.language
      : 'auto',
  )
  const transcription = useTranscription(project, onCompleted)
  const ocr = useOcr(project, onOcrSlideCompleted)
  const correction = useCorrection(project, onCorrectionSlideCompleted)
  const handleTranscribe = () => transcription.transcribe(language)
  const hasOcrResult = project.slides.some((slide) => Boolean(slide.ocr))
  const isOcrRunning = ocr.status === 'running'
  const isCorrectionRunning = correction.status === 'running'
  const isProcessing = transcription.status === 'running' || isOcrRunning || isCorrectionRunning

  return (
    <main className="flex min-h-svh flex-col bg-[#f4f7f4] font-[Avenir_Next,Hiragino_Sans,Yu_Gothic,system-ui,sans-serif] text-[18px] leading-[1.45] tracking-[0.18px] text-[#18211f]">
      <AppHeader />
      <WorkflowBar activeStep="generate-notes" />

      <section className="mx-auto flex w-[calc(100%-48px)] max-w-[1040px] flex-1 flex-col pb-12 md:w-[calc(100%-11.6vw)]">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">04 / GENERATE NOTES</p>
            <h1 className="mt-1 text-[27px] font-bold tracking-[-0.06em]">文字起こし</h1>
            <p className="mt-1 text-xs text-[#71807b]">発話をSlideの区間ごとに整理します。</p>
          </div>
          <button
            className="inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-[#71807b] transition hover:bg-[#e2eee8] hover:text-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={onBack}
            disabled={isProcessing}
          >
            <ArrowLeft size={15} strokeWidth={1.8} />
            スライド検出に戻る
          </button>
        </div>

        <div className="overflow-hidden rounded-[18px] border border-[#b7cbc0] bg-[#fbfcfa] shadow-[0_18px_52px_rgba(22,54,42,0.07)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8e1dc] px-5 py-3.5">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[#18211f]" title={project.source.path}>
                {project.source.name}
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-[#71807b]">
                {project.slides.length} slides · {Math.round(project.source.metadata.durationMs / 1000)}秒
              </p>
            </div>
          </div>

          <div className="p-5 md:p-7">
            <TranscriptionSettings
              language={language}
              status={transcription.status}
              disabled={isOcrRunning || isCorrectionRunning}
              onLanguageChange={setLanguage}
              onTranscribe={handleTranscribe}
            />
            <TranscriptionStatus
              status={transcription.status}
              stage={transcription.stage}
              stageProgress={transcription.stageProgress}
              error={transcription.error}
              disabled={isOcrRunning || isCorrectionRunning}
              onRetry={handleTranscribe}
            />
            <OcrPanel
              ocr={ocr}
              disabled={transcription.status === 'running' || isCorrectionRunning}
            />
            <CorrectionPanel
              correction={correction}
              disabled={transcription.status === 'running' || isOcrRunning}
            />
            {(transcription.status === 'completed' || hasOcrResult) && (
              <TranscriptPreview slides={project.slides} />
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
