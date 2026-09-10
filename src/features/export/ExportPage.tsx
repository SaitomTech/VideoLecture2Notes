import { ArrowLeft, ChevronDown, Download, RefreshCw } from 'lucide-react'
import { useEffect, useState, type ChangeEvent, type SyntheticEvent } from 'react'
import { AppHeader } from '../../components/AppHeader'
import { WorkflowBar } from '../../components/WorkflowBar'
import type { WorkflowStep } from '../../lib/workflow'
import type { MediaProject } from '../../types/project'
import { EXPORT_OPTIONS, type ExportFormat } from './export'
import { useExport, type ExportController } from './hooks/useExport'

type ExportPageProps = {
  project: MediaProject
  onBack: () => void
  onHome: () => void
  maxReachedStep: WorkflowStep
  onStepClick: (step: WorkflowStep) => void
}

function getStatusMessage({ status, progress, error }: ExportController) {
  switch (status) {
    case 'running':
      return progress.stage === 'copying-images'
        ? 'Slide画像をアプリ内に保存しています…'
        : 'HTML / Markdown / TXTを生成しています…'
    case 'error':
      return error ?? '書き出しに失敗しました。'
    default:
      return null
  }
}

export function ExportPage({
  project,
  onBack,
  onHome,
  maxReachedStep,
  onStepClick,
}: ExportPageProps) {
  const exporter = useExport(project)
  const { generate } = exporter
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null)
  const [previewHeight, setPreviewHeight] = useState(520)
  const isRunning = exporter.status === 'running'
  const isBusy = isRunning || isDownloading
  const statusMessage = getStatusMessage(exporter)
  const progressPercent = exporter.progress.total
    ? Math.round((exporter.progress.completed / exporter.progress.total) * 100)
    : 0

  useEffect(() => {
    void generate()
  }, [generate, project.id])

  const handleDownload = async (event: ChangeEvent<HTMLSelectElement>) => {
    const format = event.target.value as ExportFormat
    event.target.value = ''
    if (!format || isBusy) return

    setIsDownloading(true)
    setDownloadMessage(null)
    try {
      if (await exporter.download(format)) {
        const option = EXPORT_OPTIONS.find((candidate) => candidate.format === format)
        setDownloadMessage(`${option?.label ?? format}を保存しました。`)
      }
    } catch (error) {
      console.error(error)
      setDownloadMessage(error instanceof Error ? error.message : 'ダウンロードに失敗しました。')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleDownloadAll = async () => {
    if (isBusy || exporter.files.length === 0) return

    setIsDownloading(true)
    setDownloadMessage(null)
    try {
      if (await exporter.downloadAll()) setDownloadMessage('3つのファイルを保存しました。')
    } catch (error) {
      console.error(error)
      setDownloadMessage(error instanceof Error ? error.message : 'ダウンロードに失敗しました。')
    } finally {
      setIsDownloading(false)
    }
  }

  const handlePreviewLoad = (event: SyntheticEvent<HTMLIFrameElement>) => {
    const previewDocument = event.currentTarget.contentDocument
    if (!previewDocument) return

    setPreviewHeight(
      Math.max(
        420,
        previewDocument.documentElement.scrollHeight,
        previewDocument.body.scrollHeight,
      ),
    )
  }

  return (
    <main className="flex min-h-svh flex-col bg-[#f4f7f4] font-[Avenir_Next,Hiragino_Sans,Yu_Gothic,system-ui,sans-serif] text-[18px] leading-[1.45] tracking-[0.18px] text-[#18211f]">
      <AppHeader onHome={onHome} homeDisabled={isBusy} />
      <WorkflowBar
        activeStep="export"
        maxReachedStep={maxReachedStep}
        onStepClick={onStepClick}
        disabled={isBusy}
      />

      <section className="mx-auto flex w-[calc(100%-48px)] max-w-[1040px] flex-1 flex-col pb-12 md:w-[calc(100%-11.6vw)]">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">
              06 / RESULT
            </p>
            <h1 className="mt-1 text-[27px] font-bold tracking-[-0.06em]">書き出し結果</h1>
            <p className="mt-1 text-xs text-[#71807b]">
              HTMLの見た目を確認して、必要な形式をダウンロードします。
            </p>
          </div>
          <button
            className="inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-[#71807b] transition hover:bg-[#e2eee8] hover:text-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={onBack}
            disabled={isBusy}
          >
            <ArrowLeft size={15} strokeWidth={1.8} />
            記事プレビューに戻る
          </button>
        </div>

        <div className="overflow-hidden rounded-[18px] border border-[#b7cbc0] bg-[#fbfcfa] shadow-[0_18px_52px_rgba(22,54,42,0.07)]">
          <div className="flex justify-end px-5 py-4 md:px-7">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#b7cbc0] bg-[#fbfcfa] px-3 py-2 text-xs font-semibold text-[#1d6b50] transition hover:border-[#1d6b50] hover:bg-[#e2eee8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={() => void generate()}
                disabled={isBusy}
              >
                <RefreshCw size={13} />
                再生成
              </button>
              <label className="relative inline-flex items-center">
                <Download
                  className="pointer-events-none absolute left-3 text-[#f3faf6]"
                  size={14}
                />
                <select
                  className="h-10 w-[148px] cursor-pointer appearance-none rounded-[9px] bg-[#1d6b50] py-2.5 pl-9 pr-10 text-xs font-semibold text-[#f3faf6] shadow-[0_7px_16px_rgba(29,107,80,0.17)] outline-none transition hover:bg-[#174d3c] focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  defaultValue=""
                  onChange={(event) => void handleDownload(event)}
                  disabled={isBusy || exporter.files.length === 0}
                  aria-label="ダウンロード形式を選択"
                >
                  <option value="" disabled>
                    Download
                  </option>
                  <option value="html">HTML</option>
                  <option value="markdown">Markdown</option>
                  <option value="txt">TXT</option>
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex w-9 items-center justify-center border-l border-[#8eb8a5]/45 text-[#f3faf6]">
                  <ChevronDown size={16} strokeWidth={2.2} />
                </span>
              </label>
              <button
                className="inline-flex items-center gap-2 rounded-[9px] border border-[#1d6b50] bg-[#fbfcfa] px-3 py-2 text-xs font-semibold text-[#1d6b50] transition hover:bg-[#e2eee8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={() => void handleDownloadAll()}
                disabled={isBusy || exporter.files.length === 0}
              >
                <Download size={14} />
                すべてダウンロード
              </button>
            </div>
          </div>

          <div>
            {statusMessage && (
              <p
                className={`mx-5 mt-0 text-sm md:mx-7 ${exporter.error ? 'text-[#b6533a]' : 'text-[#53615b]'}`}
              >
                {statusMessage}
              </p>
            )}

            {exporter.status === 'running' && (
              <div className="mx-5 mt-3 md:mx-7">
                <div className="flex items-center justify-between font-mono text-[10px] text-[#71807b]">
                  <span>
                    {exporter.progress.completed} / {exporter.progress.total}
                  </span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#dce9e1]">
                  <div
                    className="h-full rounded-full bg-[#1d6b50] transition-[width]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {exporter.previewHtml ? (
              <iframe
                className="block min-h-[420px] w-full border-0 bg-[#fbfcfa]"
                title="生成された記事"
                srcDoc={exporter.previewHtml}
                sandbox="allow-scripts allow-same-origin"
                scrolling="no"
                style={{ height: `${previewHeight}px` }}
                onLoad={handlePreviewLoad}
              />
            ) : (
              <div className="mx-5 mt-5 flex min-h-[420px] items-center justify-center rounded-[12px] border border-dashed border-[#b7cbc0] bg-[#f4f7f4] px-5 text-center text-xs text-[#71807b] md:mx-7">
                {exporter.status === 'error'
                  ? '書き出し結果を表示できません。記事プレビューに戻って内容を確認してください。'
                  : '結果を準備しています…'}
              </div>
            )}
          </div>
        </div>

        {downloadMessage && (
          <p className="mt-4 text-xs text-[#1d6b50]" role="status">
            {downloadMessage}
          </p>
        )}
      </section>
    </main>
  )
}
