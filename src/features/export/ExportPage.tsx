import { ArrowLeft, Check, Download, FolderOpen } from 'lucide-react'
import { useState } from 'react'
import { AppHeader } from '../../components/AppHeader'
import { WorkflowBar } from '../../components/WorkflowBar'
import { formatTimestamp } from '../../lib/time'
import { pickExportDirectory } from '../../lib/tauri/dialog'
import type { MediaProject } from '../../types/project'
import { EXPORT_OPTIONS, type ExportFormat } from './export'
import { useExport, type ExportController } from './hooks/useExport'

type ExportPageProps = {
  project: MediaProject
  onBack: () => void
  onOpenProjects: () => void
}

function getStatusMessage({ status, progress, files }: ExportController) {
  switch (status) {
    case 'running':
      return progress.stage === 'copying-images' ? 'Slide画像をコピーしています…' : 'ファイルを書き出しています…'
    case 'completed':
      return `${files.length}ファイルを書き出しました。`
    case 'error':
      return 'Exportに失敗しました。'
    default:
      return '出力形式と保存先を確認して、Exportを開始してください。'
  }
}

export function ExportPage({ project, onBack, onOpenProjects }: ExportPageProps) {
  const [destination, setDestination] = useState('')
  const [selectedFormats, setSelectedFormats] = useState<ExportFormat[]>(['html', 'markdown'])
  const exporter = useExport(project)
  const isRunning = exporter.status === 'running'
  const progressPercent = exporter.progress.total
    ? Math.round((exporter.progress.completed / exporter.progress.total) * 100)
    : 0

  const handlePickDirectory = async () => {
    try {
      const selected = await pickExportDirectory()
      if (selected) setDestination(selected)
    } catch (error) {
      console.error(error)
    }
  }

  const handleToggleFormat = (format: ExportFormat) => {
    setSelectedFormats((current) =>
      current.includes(format) ? current.filter((selected) => selected !== format) : [...current, format],
    )
  }

  const handleExport = () => {
    if (!destination || selectedFormats.length === 0) return
    void exporter.exportNotes(destination, selectedFormats)
  }

  return (
    <main className="flex min-h-svh flex-col bg-[#f4f7f4] font-[Avenir_Next,Hiragino_Sans,Yu_Gothic,system-ui,sans-serif] text-[18px] leading-[1.45] tracking-[0.18px] text-[#18211f]">
      <AppHeader onOpenProjects={onOpenProjects} projectsDisabled={isRunning} />
      <WorkflowBar activeStep="export" />

      <section className="mx-auto flex w-[calc(100%-48px)] max-w-[1040px] flex-1 flex-col pb-12 md:w-[calc(100%-11.6vw)]">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">05 / EXPORT</p>
            <h1 className="mt-1 text-[27px] font-bold tracking-[-0.06em]">記事を書き出す</h1>
            <p className="mt-1 text-xs text-[#71807b]">HTML/Markdownは画像付き、TXTは本文のみでこのMacに保存します。</p>
          </div>
          <button
            className="inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-[#71807b] transition hover:bg-[#e2eee8] hover:text-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={onBack}
            disabled={isRunning}
          >
            <ArrowLeft size={15} strokeWidth={1.8} />
            記事プレビューに戻る
          </button>
        </div>

        <div className="overflow-hidden rounded-[18px] border border-[#b7cbc0] bg-[#fbfcfa] shadow-[0_18px_52px_rgba(22,54,42,0.07)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8e1dc] px-5 py-4 md:px-7">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#18211f]" title={project.source.path}>
                {project.article?.title || project.source.name.replace(/\.[^.]+$/, '')}
              </p>
              <p className="mt-1 font-mono text-[10px] text-[#71807b]">
                {project.source.name} · {project.slides.length} Slides ·{' '}
                {formatTimestamp(project.source.metadata.durationMs)}
              </p>
            </div>
          </div>

          <div className="divide-y divide-[#d8e1dc]">
            <section className="px-5 py-6 md:px-7" aria-labelledby="export-destination-heading">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">01 / 保存先</p>
                  <h2 id="export-destination-heading" className="mt-1 text-[19px] font-bold tracking-[-0.04em]">
                    保存先フォルダ
                  </h2>
                </div>
                <button
                  className="inline-flex items-center gap-2 rounded-[9px] border border-[#b7cbc0] bg-[#fbfcfa] px-3 py-2 text-xs font-semibold text-[#1d6b50] transition hover:border-[#1d6b50] hover:bg-[#e2eee8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  onClick={() => void handlePickDirectory()}
                  disabled={isRunning}
                >
                  <FolderOpen size={14} />
                  {destination ? '保存先を変更' : 'フォルダを選択'}
                </button>
              </div>
              <div className="mt-4 rounded-[9px] border border-dashed border-[#b7cbc0] bg-[#f4f7f4] px-3 py-3 font-mono text-xs text-[#53615b]">
                {destination || '保存先を選択してください'}
              </div>
            </section>

            <section className="px-5 py-6 md:px-7" aria-labelledby="export-formats-heading">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">02 / 形式</p>
                  <h2 id="export-formats-heading" className="mt-1 text-[19px] font-bold tracking-[-0.04em]">
                    出力形式
                  </h2>
                </div>
                <span className="text-xs text-[#71807b]">複数選択できます</span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {EXPORT_OPTIONS.map(({ format, label, filename, description }) => {
                  const checked = selectedFormats.includes(format)

                  return (
                    <label
                      className={`flex min-h-[88px] cursor-pointer flex-col justify-between rounded-[9px] border px-3 py-3 transition ${
                        checked
                          ? 'border-[#1d6b50] bg-[#e8f2ec]'
                          : 'border-[#d8e1dc] bg-[#fbfcfa] hover:border-[#9dbbad]'
                      }`}
                      key={format}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span>
                          <span className="block font-mono text-xs font-semibold text-[#1d6b50]">{label}</span>
                          <span className="mt-1 block text-[11px] leading-5 text-[#71807b]">
                            {description}
                          </span>
                        </span>
                        <input
                          className="mt-0.5 h-4 w-4 accent-[#1d6b50]"
                          type="checkbox"
                          checked={checked}
                          disabled={isRunning}
                          onChange={() => handleToggleFormat(format)}
                        />
                      </span>
                      <span className="font-mono text-[10px] text-[#71807b]">{filename}</span>
                    </label>
                  )
                })}
              </div>
              <p className="mt-3 font-mono text-[10px] text-[#71807b]">
                HTML/MarkdownではSlide画像を assets/ に保存し、TXTには画像を含めません。
              </p>
            </section>

            <section className="bg-[#f4f7f4]/70 px-5 py-6 md:px-7" aria-labelledby="export-status-heading">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">03 / 実行</p>
                  <h2 id="export-status-heading" className="mt-1 text-[19px] font-bold tracking-[-0.04em]">
                    Export状況
                  </h2>
                </div>
                <button
                  className="inline-flex items-center gap-2 rounded-[9px] bg-[#1d6b50] px-4 py-2.5 text-xs font-semibold text-[#f3faf6] transition hover:bg-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
                  type="button"
                  onClick={handleExport}
                  disabled={!destination || selectedFormats.length === 0 || isRunning}
                >
                  <Download size={14} />
                  Exportを開始
                </button>
              </div>

              <p className={`mt-5 text-sm ${exporter.error ? 'text-[#b6533a]' : 'text-[#53615b]'}`}>
                {getStatusMessage(exporter)}
              </p>
              {exporter.status === 'running' && (
                <div className="mt-3">
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
              {exporter.error && <p className="mt-3 text-xs text-[#b6533a]">{exporter.error}</p>}
              {exporter.status === 'completed' && (
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#1d6b50]">
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <Check size={14} /> 保存しました
                  </span>
                  {exporter.files.map((file) => (
                    <span className="font-mono" key={file}>
                      {file}
                    </span>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </section>
    </main>
  )
}
