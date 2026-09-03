import { AlertTriangle, ArrowRight, FileVideo, FolderOpen, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { AppHeader } from '../../components/AppHeader'
import { getErrorDetail } from '../../lib/errors'
import { formatTimestamp } from '../../lib/time'
import { listProjects } from '../../lib/storage/projectStorage'
import { getFileSize } from '../../lib/tauri/filesystem'
import { pickVideoPath } from '../../lib/tauri/dialog'
import { probeVideo } from '../../lib/media/ffprobe'
import { getExtension, getFileName, isSupportedVideo } from '../import/utils'
import type { MediaSource, ProjectLibraryEntry, ProjectSummary } from '../../types/project'

type ProjectLibraryPageProps = {
  onCreateProject: () => void
  onOpenProject: (projectId: string) => Promise<void>
  onRelinkProject: (projectId: string, source: MediaSource) => Promise<void>
  onDeleteProject: (projectId: string) => Promise<void>
}

const projectDateFormatter = new Intl.DateTimeFormat('ja-JP', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function relativeDate(value: string) {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return '日時不明'

  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000))
  if (elapsedMinutes < 1) return 'たった今'
  if (elapsedMinutes < 60) return `${elapsedMinutes}分前`

  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${elapsedHours}時間前`

  const elapsedDays = Math.floor(elapsedHours / 24)
  if (elapsedDays < 7) return `${elapsedDays}日前`

  return projectDateFormatter.format(new Date(timestamp))
}

function statusCopy(summary: ProjectSummary) {
  if (summary.health === 'source-missing') {
    return { label: '元動画が見つかりません', className: 'text-[#a4573e] bg-[#fff3ee]' }
  }
  if (summary.health === 'needs-repair') {
    return { label: '再生成が必要です', className: 'text-[#9a7a35] bg-[#faf4df]' }
  }
  if (summary.resumeStep === 'article-review' || summary.resumeStep === 'export') {
    return { label: '確認できます', className: 'text-[#1d6b50] bg-[#e8f2ec]' }
  }
  if (summary.slideCount === 0) {
    return { label: '準備中', className: 'text-[#9a7a35] bg-[#faf4df]' }
  }
  return { label: '作業途中', className: 'text-[#53615b] bg-[#eef3ef]' }
}

function progressCopy(summary: ProjectSummary) {
  if (summary.health === 'source-missing') return '動画を再指定すると続きから再開できます。'
  if (summary.health === 'needs-repair') return 'Slide画像を再生成すると続きから再開できます。'
  if (summary.resumeStep === 'crop') return 'スライド領域を設定できます。'
  if (summary.resumeStep === 'detect-slides') return `${summary.slideCount || 'まだ'}枚のSlideを検出します。`
  if (summary.resumeStep === 'generate-notes') {
    if (summary.articleTarget > 0) {
      return `本文 ${summary.articleCompleted} / ${summary.articleTarget} · OCR ${summary.ocrCompleted} / ${summary.slideCount}`
    }
    return `OCR ${summary.ocrCompleted} / ${summary.slideCount} · 文字起こしから続行`
  }
  if (summary.resumeStep === 'export') return '記事をExportできます。'
  return '記事本文を確認・編集できます。'
}

function ProjectThumbnail({ summary }: { summary: ProjectSummary }) {
  const [hasError, setHasError] = useState(false)
  const source = summary.thumbnailPath && !hasError ? convertFileSrc(summary.thumbnailPath) : null

  return (
    <div className="grid aspect-video w-[128px] shrink-0 place-items-center overflow-hidden rounded-[9px] border border-[#d8e1dc] bg-[#e5eee8] sm:w-[164px]">
      {source ? (
        <img
          className="h-full w-full object-cover"
          src={source}
          alt=""
          loading="lazy"
          onError={() => setHasError(true)}
        />
      ) : (
        <FileVideo className="text-[#9aada3]" size={25} strokeWidth={1.4} aria-hidden="true" />
      )}
    </div>
  )
}

function ProjectRow({
  summary,
  busy,
  onOpen,
  onRelink,
  onDelete,
}: {
  summary: ProjectSummary
  busy: boolean
  onOpen: () => void
  onRelink: () => void
  onDelete: () => void
}) {
  const status = statusCopy(summary)
  const canOpen = summary.health !== 'source-missing'

  return (
    <article className="group flex flex-col gap-4 border-b border-[#d8e1dc] px-4 py-4 first:border-t sm:flex-row sm:items-center sm:px-5">
      <ProjectThumbnail summary={summary} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="min-w-0 truncate text-[15px] font-semibold tracking-[-0.02em] text-[#18211f]">
            {summary.title}
          </h2>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>
            {status.label}
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-[#53615b]" title={summary.sourcePath}>
          {summary.sourceName}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-[#71807b]">
          <span>{formatTimestamp(summary.durationMs)}</span>
          <span>{summary.slideCount} Slides</span>
          <span>{relativeDate(summary.lastOpenedAt)}</span>
        </div>
        <p className="mt-2 text-xs text-[#71807b]">{progressCopy(summary)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-stretch">
        {summary.health === 'source-missing' ? (
          <button
            className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-[#d6a18f] bg-[#fffaf7] px-3 py-2 text-xs font-semibold text-[#a4573e] transition hover:bg-[#fff0e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6533a]/25 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={onRelink}
            disabled={busy}
          >
            <FolderOpen size={14} />
            動画を再指定
          </button>
        ) : (
          <button
            className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-[#1d6b50] px-3 py-2 text-xs font-semibold text-[#f3faf6] transition hover:bg-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={onOpen}
            disabled={!canOpen || busy}
          >
            {busy ? <RefreshCw className="animate-spin" size={14} /> : <ArrowRight size={14} />}
            再開
          </button>
        )}
        <button
          className="inline-flex items-center justify-center rounded-[8px] px-2.5 py-2 text-xs text-[#9aa6a1] transition hover:bg-[#f8ebe7] hover:text-[#a4573e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6533a]/25 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={onDelete}
          disabled={busy}
          aria-label={`${summary.title}を削除`}
          title="プロジェクトを削除"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </article>
  )
}

export function ProjectLibraryPage({
  onCreateProject,
  onOpenProject,
  onRelinkProject,
  onDeleteProject,
}: ProjectLibraryPageProps) {
  const [entries, setEntries] = useState<ProjectLibraryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const nextEntries = await listProjects()
      setEntries(nextEntries)
      setError(null)
    } catch (loadError) {
      setError(getErrorDetail(loadError, 'プロジェクト一覧を読み込めませんでした。'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleOpen = async (projectId: string) => {
    setBusyProjectId(projectId)
    setError(null)
    try {
      await onOpenProject(projectId)
    } catch (openError) {
      setError(getErrorDetail(openError, 'プロジェクトを開けませんでした。'))
    } finally {
      setBusyProjectId(null)
    }
  }

  const handleRelink = async (projectId: string) => {
    setBusyProjectId(projectId)
    setError(null)
    try {
      const path = await pickVideoPath()
      if (!path) return

      const name = getFileName(path)
      if (!isSupportedVideo(name)) throw new Error('対応している動画ファイルを選択してください。')

      const [metadata, sizeBytes] = await Promise.all([probeVideo(path), getFileSize(path)])
      await onRelinkProject(projectId, {
        path,
        name,
        extension: getExtension(name) as MediaSource['extension'],
        sizeBytes,
        metadata,
      })
      await refresh()
    } catch (relinkError) {
      setError(getErrorDetail(relinkError, '元動画を再指定できませんでした。'))
    } finally {
      setBusyProjectId(null)
    }
  }

  const [pendingDelete, setPendingDelete] = useState<ProjectSummary | null>(null)

  const handleDelete = (summary: ProjectSummary) => {
    setError(null)
    setPendingDelete(summary)
  }

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return

    const projectId = pendingDelete.id
    setBusyProjectId(projectId)
    setError(null)
    try {
      await onDeleteProject(projectId)
      setPendingDelete(null)
      await refresh()
    } catch (deleteError) {
      setError(getErrorDetail(deleteError, 'プロジェクトを削除できませんでした。'))
    } finally {
      setBusyProjectId(null)
    }
  }

  const projectEntries = entries.filter((entry): entry is Extract<ProjectLibraryEntry, { kind: 'project' }> => entry.kind === 'project')
  const invalidEntries = entries.filter((entry) => entry.kind === 'invalid')

  return (
    <main className="flex min-h-svh flex-col bg-[#f4f7f4] font-[Avenir_Next,Hiragino_Sans,Yu_Gothic,system-ui,sans-serif] text-[18px] leading-[1.45] tracking-[0.18px] text-[#18211f]">
      <AppHeader />
      <section className="mx-auto flex w-[calc(100%-48px)] max-w-[1040px] flex-1 flex-col pb-12 pt-12 md:w-[calc(100%-11.6vw)] md:pt-16">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">00 / PROJECTS</p>
            <h1 className="mt-1 text-[30px] font-bold tracking-[-0.07em]">プロジェクト</h1>
            <p className="mt-2 text-xs text-[#71807b]">保存した作業の続きをここから再開できます。</p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-[9px] bg-[#1d6b50] px-4 py-3 text-xs font-semibold text-[#f3faf6] shadow-[0_7px_16px_rgba(29,107,80,0.17)] transition hover:bg-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2"
            type="button"
            onClick={onCreateProject}
          >
            <Plus size={15} />
            新しい動画から作成
          </button>
        </div>

        {error && (
          <div className="mt-6 flex items-start gap-2 rounded-[9px] border border-[#d6a18f] bg-[#fff8f5] px-4 py-3 text-xs text-[#a4573e]" role="alert">
            <AlertTriangle className="mt-0.5 shrink-0" size={14} />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="mt-10 flex items-center justify-center gap-2 py-20 text-xs text-[#71807b]" aria-live="polite">
            <RefreshCw className="animate-spin" size={15} />
            プロジェクトを確認しています…
          </div>
        ) : projectEntries.length === 0 && invalidEntries.length === 0 ? (
          <div className="mt-10 flex flex-1 flex-col items-center justify-center border-y border-dashed border-[#b7cbc0] px-6 py-16 text-center">
            <FileVideo className="text-[#9aada3]" size={32} strokeWidth={1.3} />
            <h2 className="mt-4 text-[17px] font-semibold tracking-[-0.03em]">まだプロジェクトがありません</h2>
            <p className="mt-2 max-w-[360px] text-xs leading-6 text-[#71807b]">動画を読み込むと、ここに作業の進行状況と再開ボタンが表示されます。</p>
            <button
              className="mt-6 inline-flex items-center gap-2 rounded-[9px] border border-[#b7cbc0] bg-[#fbfcfa] px-4 py-3 text-xs font-semibold text-[#1d6b50] transition hover:border-[#1d6b50] hover:bg-[#e2eee8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30"
              type="button"
              onClick={onCreateProject}
            >
              <Plus size={14} />
              最初の動画を読み込む
            </button>
          </div>
        ) : (
          <div className="mt-10 overflow-hidden rounded-[14px] border border-[#b7cbc0] bg-[#fbfcfa] shadow-[0_18px_52px_rgba(22,54,42,0.05)]">
            <div className="flex items-center justify-between border-b border-[#d8e1dc] px-4 py-3 sm:px-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">
                {projectEntries.length} PROJECT{projectEntries.length === 1 ? '' : 'S'}
              </p>
              <button
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] font-semibold text-[#71807b] transition hover:bg-[#e2eee8] hover:text-[#1d6b50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25"
                type="button"
                onClick={() => void refresh()}
              >
                <RefreshCw size={12} />
                更新
              </button>
            </div>
            {projectEntries.map(({ summary }) => (
              <ProjectRow
                key={summary.id}
                summary={summary}
                busy={busyProjectId === summary.id}
                onOpen={() => void handleOpen(summary.id)}
                onRelink={() => void handleRelink(summary.id)}
                onDelete={() => handleDelete(summary)}
              />
            ))}
            {invalidEntries.map((entry) => (
              <div className="flex items-start gap-3 border-b border-[#d8e1dc] px-4 py-4 text-xs text-[#a4573e] last:border-b-0 sm:px-5" key={entry.id}>
                <AlertTriangle className="mt-0.5 shrink-0" size={15} />
                <div>
                  <p className="font-semibold">読み込めないプロジェクトがあります</p>
                  <p className="mt-1 text-[#71807b]">{entry.error}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      {pendingDelete && (
        <dialog
          className="fixed inset-0 z-50 m-0 grid h-full w-full max-h-none max-w-none place-items-center border-0 bg-[#18211f]/35 px-5 py-8 backdrop-blur-[2px]"
          open
          aria-modal="true"
          aria-labelledby="delete-project-title"
          aria-describedby="delete-project-description"
          onCancel={(event) => {
            event.preventDefault()
            if (!busyProjectId) setPendingDelete(null)
          }}
        >
          <section
            className="w-full max-w-[430px] rounded-[16px] border border-[#d6a18f] bg-[#fffdfb] p-5 shadow-[0_24px_70px_rgba(24,33,31,0.2)] sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#fff0e9] text-[#b6533a]">
                  <Trash2 size={16} />
                </span>
                <div>
                  <h2 id="delete-project-title" className="text-[17px] font-bold tracking-[-0.04em] text-[#18211f]">
                    プロジェクトを完全に削除しますか？
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-[#a4573e]">この操作は元に戻せません。</p>
                </div>
              </div>
              <button
                className="rounded-md p-1.5 text-[#9aa6a1] transition hover:bg-[#f8ebe7] hover:text-[#a4573e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6533a]/25 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={Boolean(busyProjectId)}
                aria-label="削除をキャンセル"
              >
                <X size={17} />
              </button>
            </div>
            <div className="mt-5 rounded-[9px] border border-[#e8d4cc] bg-[#fff8f5] px-3 py-3">
              <p className="truncate text-sm font-semibold text-[#18211f]" title={pendingDelete.title}>
                {pendingDelete.title}
              </p>
              <p className="mt-1 truncate font-mono text-[10px] text-[#71807b]" title={pendingDelete.sourcePath}>
                {pendingDelete.sourceName}
              </p>
            </div>
            <p id="delete-project-description" className="mt-4 text-xs leading-6 text-[#53615b]">
              保存済みのJSON、Slide画像、音声キャッシュ、解析結果を削除します。元動画とモデルは削除されません。
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                className="rounded-[8px] px-3 py-2.5 text-xs font-semibold text-[#71807b] transition hover:bg-[#eef3ef] hover:text-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={Boolean(busyProjectId)}
              >
                キャンセル
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-[8px] bg-[#b6533a] px-3.5 py-2.5 text-xs font-semibold text-[#fffaf7] transition hover:bg-[#963d2a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6533a]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={() => void handleConfirmDelete()}
                disabled={Boolean(busyProjectId)}
              >
                {busyProjectId ? <RefreshCw className="animate-spin" size={14} /> : <Trash2 size={14} />}
                {busyProjectId ? '削除中…' : '完全に削除'}
              </button>
            </div>
          </section>
        </dialog>
      )}
    </main>
  )
}
