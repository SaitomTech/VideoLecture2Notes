import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { AppHeader } from '../../components/AppHeader'
import { WorkflowBar } from '../../components/WorkflowBar'
import { getTextModel, type TextModelId } from '../../lib/llama/textModel'
import { getOcrModel, type OcrModelId } from '../../lib/ocr/modelManager'
import type { CorrectionLevel, MediaProject, TranscriptionResult } from '../../types/project'
import { DEFAULT_CORRECTION_LEVEL } from '../correction/correction'
import { AnalysisResultPreview } from '../content-processing/components/AnalysisResultPreview'
import {
  ContentProcessingPanel,
  ContentProcessingStatus,
} from '../content-processing/components/ContentProcessingPanel'
import type { ContentProcessingSlideCompleted } from '../content-processing/contentProcessing'
import { useContentProcessing } from '../content-processing/hooks/useContentProcessing'
import { OcrPanel, OcrStatus } from '../ocr/components/OcrPanel'
import { useOcr } from '../ocr/hooks/useOcr'
import type { OcrSlideCompleted } from '../ocr/ocr'
import { TranscriptionSettings } from './components/TranscriptionSettings'
import { TranscriptionStatus } from './components/TranscriptionStatus'
import { useTranscription } from './hooks/useTranscription'
import type { TranscriptionLanguage } from './transcription'

type GenerateNotesPageProps = {
  project: MediaProject
  onBack: () => void
  onCompleted: (result: TranscriptionResult) => void | Promise<void>
  onOcrSlideCompleted: OcrSlideCompleted
  onContentSlideCompleted: ContentProcessingSlideCompleted
  onOpenArticleReview: () => void
}

export function GenerateNotesPage({
  project,
  onBack,
  onCompleted,
  onOcrSlideCompleted,
  onContentSlideCompleted,
  onOpenArticleReview,
}: GenerateNotesPageProps) {
  const [language, setLanguage] = useState<TranscriptionLanguage>(
    project.transcription?.language === 'ja' || project.transcription?.language === 'en'
      ? project.transcription.language
      : 'auto',
  )
  const storedOcrModelId = project.slides
    .map((slide) => slide.ocr?.model)
    .find((modelId): modelId is string => Boolean(modelId))
  const [ocrModelId, setOcrModelId] = useState<OcrModelId>(
    () => getOcrModel(storedOcrModelId).id,
  )
  const storedTextModelId = project.slides
    .map((slide) => slide.transcript?.articleModel)
    .find((modelId): modelId is string => Boolean(modelId))
  const [textModelId, setTextModelId] = useState<TextModelId>(
    () => getTextModel(storedTextModelId).id,
  )
  const storedCorrectionLevel = project.slides
    .map((slide) => slide.transcript?.correctionLevel)
    .find((level): level is CorrectionLevel => level !== undefined)
  const [correctionLevel, setCorrectionLevel] = useState<CorrectionLevel>(
    storedCorrectionLevel ?? DEFAULT_CORRECTION_LEVEL,
  )
  const textModel = getTextModel(textModelId)
  const transcription = useTranscription(project, onCompleted)
  const ocr = useOcr(project, onOcrSlideCompleted, ocrModelId)
  const processing = useContentProcessing(
    project,
    onContentSlideCompleted,
    textModelId,
    correctionLevel,
  )
  const handleTranscribe = () => transcription.transcribe(language)
  const isOcrRunning = ocr.status === 'running'
  const isContentProcessing = processing.status === 'running'
  const isProcessing = transcription.status === 'running' || isOcrRunning || isContentProcessing
  const handleTextModelChange = (nextModelId: TextModelId) => {
    processing.reset()
    setTextModelId(nextModelId)
  }
  const handleCorrectionLevelChange = (nextLevel: CorrectionLevel) => {
    processing.reset()
    setCorrectionLevel(nextLevel)
  }

  return (
    <main className="flex min-h-svh flex-col bg-[#f4f7f4] font-[Avenir_Next,Hiragino_Sans,Yu_Gothic,system-ui,sans-serif] text-[18px] leading-[1.45] tracking-[0.18px] text-[#18211f]">
      <AppHeader />
      <WorkflowBar activeStep="generate-notes" />

      <section className="mx-auto flex w-[calc(100%-48px)] max-w-[1040px] flex-1 flex-col pb-12 md:w-[calc(100%-11.6vw)]">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">
              04 / GENERATE NOTES
            </p>
            <h1 className="mt-1 text-[27px] font-bold tracking-[-0.06em]">ノートを生成</h1>
            <p className="mt-1 text-xs text-[#71807b]">OCR、文字起こし、本文生成を順に実行します。</p>
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
              <p
                className="truncate text-xs font-semibold text-[#18211f]"
                title={project.source.path}
              >
                {project.source.name}
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-[#71807b]">
                {project.slides.length} slides ·{' '}
                {Math.round(project.source.metadata.durationMs / 1000)}秒
              </p>
            </div>
          </div>

          <div className="p-5 md:p-7">
            <section aria-labelledby="analysis-settings-heading">
              <div>
                <h2
                  id="analysis-settings-heading"
                  className="text-[21px] font-bold tracking-[-0.05em]"
                >
                  1. 解析の設定・実行
                </h2>
                <p className="mt-1 text-xs text-[#71807b]">
                  3つの処理に必要な設定を確認して、順番に実行します。解析結果は下の「2. 解析結果の確認」で確認できます。
                </p>
              </div>

              <div className="mt-6 space-y-10">
                <div>
                  <OcrPanel
                    ocr={ocr}
                    modelId={ocrModelId}
                    onModelChange={setOcrModelId}
                    disabled={transcription.status === 'running' || isContentProcessing}
                  />
                  <div className="mt-6">
                    <OcrStatus
                      ocr={ocr}
                      disabled={transcription.status === 'running' || isContentProcessing}
                    />
                  </div>
                </div>

                <div>
                  <TranscriptionSettings
                    language={language}
                    status={transcription.status}
                    disabled={isOcrRunning || isContentProcessing}
                    onLanguageChange={setLanguage}
                    onTranscribe={handleTranscribe}
                    onCancel={transcription.cancel}
                  />
                  <div className="mt-6">
                    <TranscriptionStatus
                      status={transcription.status}
                      stage={transcription.stage}
                      stageProgress={transcription.stageProgress}
                      error={transcription.error}
                      disabled={isOcrRunning || isContentProcessing}
                      onRetry={handleTranscribe}
                    />
                  </div>
                </div>

                <div>
                  <ContentProcessingPanel
                    processing={processing}
                    model={textModel}
                    modelId={textModelId}
                    level={correctionLevel}
                    onModelChange={handleTextModelChange}
                    onLevelChange={handleCorrectionLevelChange}
                    disabled={transcription.status === 'running' || isOcrRunning}
                  />
                  <div className="mt-6">
                    <ContentProcessingStatus
                      processing={processing}
                      disabled={transcription.status === 'running' || isOcrRunning}
                    />
                  </div>
                </div>
              </div>
            </section>

            <AnalysisResultPreview slides={project.slides} onEdit={onOpenArticleReview} />
          </div>
        </div>
      </section>
    </main>
  )
}
