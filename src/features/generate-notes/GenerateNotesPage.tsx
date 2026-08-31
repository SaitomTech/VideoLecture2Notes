import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { AppHeader } from '../../components/AppHeader'
import { WorkflowBar } from '../../components/WorkflowBar'
import type { MediaProject } from '../../types/project'
import { TranscriptionSettings } from './components/TranscriptionSettings'
import { TranscriptionStatus } from './components/TranscriptionStatus'
import { TranscriptPreview } from './components/TranscriptPreview'
import { useTranscription } from './hooks/useTranscription'
import type { TranscriptionLanguage } from './transcription'
import type { TranscriptionOutput } from './types'

type GenerateNotesPageProps = {
  project: MediaProject
  onBack: () => void
  onCompleted: (output: TranscriptionOutput) => void | Promise<void>
}

export function GenerateNotesPage({ project, onBack, onCompleted }: GenerateNotesPageProps) {
  const [language, setLanguage] = useState<TranscriptionLanguage>(
    project.transcription?.language === 'ja' || project.transcription?.language === 'en'
      ? project.transcription.language
      : 'auto',
  )
  const transcription = useTranscription(project, { onCompleted })
  const slides = transcription.output?.slides ?? []
  const handleTranscribe = () => transcription.transcribe(language)

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
            disabled={transcription.status === 'running'}
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
              onLanguageChange={setLanguage}
              onTranscribe={handleTranscribe}
            />
            <TranscriptionStatus
              status={transcription.status}
              stage={transcription.stage}
              stageProgress={transcription.stageProgress}
              error={transcription.error}
              onRetry={handleTranscribe}
            />
            {transcription.output && transcription.status === 'completed' && (
              <TranscriptPreview slides={slides} />
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
