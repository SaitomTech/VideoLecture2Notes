import { AlertTriangle, ArrowRight, FileVideo, FolderOpen, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
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
import type { MediaSource, ProjectListEntry, ProjectSummary } from '../../types/project'

type HomePageProps = {
  onHome: () => void
  onCreateProject: () => void
  onOpenProject: (projectId: string) => Promise<void>
  onRelinkProject: (projectId: string, source: MediaSource) => Promise<void>
  onDeleteProject: (projectId: string) => Promise<void>
}

type DeleteRequest =
  | { kind: 'single'; projects: [ProjectSummary] }
  | { kind: 'bulk'; projects: ProjectSummary[] }

const RECENT_PROJECT_LIMIT = 12

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
  if (summary.resumeStep === 'crop') return '動画の範囲とスライド領域を設定できます。'
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
  selected,
  onSelect,
  onOpen,
  onRelink,
  onDelete,
}: {
  summary: ProjectSummary
  busy: boolean
  selected: boolean
  onSelect: () => void
  onOpen: () => void
  onRelink: () => void
  onDelete: () => void
}) {
  const status = statusCopy(summary)
  const canOpen = summary.health !== 'source-missing'

  return (
    <article
      className={`group flex flex-col gap-4 border-b border-[#d8e1dc] px-4 py-4 first:border-t transition-colors sm:flex-row sm:items-center sm:px-5 ${
        selected ? 'bg-[#e8f2ec]/70' : 'hover:bg-[#f4f7f4]/70'
      }`}
    >
      <label className="flex shrink-0 items-center gap-2 self-start pt-1 sm:self-center">
        <input
          className="h-4 w-4 accent-[#1d6b50]"
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          disabled={busy}
          aria-label={`${summary.title}を選択`}
        />
      </label>
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

function DeleteProjectDialog({
  request,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  request: DeleteRequest
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const deleteTargets = request.projects

  return (
    <dialog
      className="fixed inset-0 z-50 m-0 grid h-full w-full max-h-none max-w-none place-items-center border-0 bg-[#18211f]/35 px-5 py-8 backdrop-blur-[2px]"
      open
      aria-modal="true"
      aria-labelledby="delete-project-title"
      aria-describedby="delete-project-description"
      onCancel={(event) => {
        event.preventDefault()
        if (!isDeleting) onCancel()
      }}
    >
      <section className="w-full max-w-[430px] rounded-[16px] border border-[#d6a18f] bg-[#fffdfb] p-5 shadow-[0_24px_70px_rgba(24,33,31,0.2)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#fff0e9] text-[#b6533a]">
              <Trash2 size={16} />
            </span>
            <div>
              <h2 id="delete-project-title" className="text-[17px] font-bold tracking-[-0.04em] text-[#18211f]">
                {request.kind === 'bulk'
                  ? `${deleteTargets.length}件のプロジェクトを完全に削除しますか？`
                  : 'プロジェクトを完全に削除しますか？'}
              </h2>
              <p className="mt-1 text-xs font-semibold text-[#a4573e]">この操作は元に戻せません。</p>
            </div>
          </div>
          <button
            className="rounded-md p-1.5 text-[#9aa6a1] transition hover:bg-[#f8ebe7] hover:text-[#a4573e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6533a]/25 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            aria-label="削除をキャンセル"
          >
            <X size={17} />
          </button>
        </div>
        <div className="mt-5 rounded-[9px] border border-[#e8d4cc] bg-[#fff8f5] px-3 py-3">
          <p className="truncate text-sm font-semibold text-[#18211f]">
            {request.kind === 'bulk' ? `${deleteTargets.length}件のプロジェクト` : deleteTargets[0]?.title}
          </p>
          <p className="mt-1 truncate font-mono text-[10px] text-[#71807b]">
            {request.kind === 'bulk'
              ? deleteTargets
                  .slice(0, 3)
                  .map((project) => project.title)
                  .join('、') + (deleteTargets.length > 3 ? ` ほか${deleteTargets.length - 3}件` : '')
              : deleteTargets[0]?.sourceName}
          </p>
        </div>
        <p id="delete-project-description" className="mt-4 text-xs leading-6 text-[#53615b]">
          {request.kind === 'bulk'
            ? '選択したプロジェクトのJSON、取得した動画コピー、Slide画像、音声キャッシュ、解析結果を削除します。'
            : '保存済みのJSON、取得した動画コピー、Slide画像、音声キャッシュ、解析結果を削除します。'}
          元のローカル動画とモデルは削除されません。
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            className="rounded-[8px] px-3 py-2.5 text-xs font-semibold text-[#71807b] transition hover:bg-[#eef3ef] hover:text-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
          >
            キャンセル
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-[8px] bg-[#b6533a] px-3.5 py-2.5 text-xs font-semibold text-[#fffaf7] transition hover:bg-[#963d2a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6533a]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? <RefreshCw className="animate-spin" size={14} /> : <Trash2 size={14} />}
            {isDeleting ? '削除中…' : request.kind === 'bulk' ? `${deleteTargets.length}件を削除` : '完全に削除'}
          </button>
        </div>
      </section>
    </dialog>
  )
}

type ProjectEntry = Extract<ProjectListEntry, { kind: 'project' }>
type InvalidProjectEntry = Extract<ProjectListEntry, { kind: 'invalid' }>

function ProjectSearchTools({
  searchQuery,
  normalizedSearchQuery,
  projectCount,
  filteredCount,
  selectedCount,
  onSearchChange,
}: {
  searchQuery: string
  normalizedSearchQuery: string
  projectCount: number
  filteredCount: number
  selectedCount: number
  onSearchChange: (value: string) => void
}) {
  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <label className="relative block min-w-0 flex-1 sm:max-w-[440px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa6a1]" size={15} />
        <input
          className="h-10 w-full rounded-[9px] border border-[#b7cbc0] bg-[#fbfcfa] pl-9 pr-3 text-xs text-[#18211f] outline-none transition placeholder:text-[#9aa6a1] focus:border-[#1d6b50] focus:ring-2 focus:ring-[#1d6b50]/15"
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="タイトル・動画名・保存先で検索"
          aria-label="プロジェクトを検索"
        />
      </label>
      <div className="flex shrink-0 items-center gap-2 text-[10px] text-[#71807b]">
        <span>{normalizedSearchQuery ? `${filteredCount}件` : `${projectCount}件`}</span>
        {selectedCount > 0 && <span className="font-semibold text-[#1d6b50]">{selectedCount}件を選択中</span>}
      </div>
    </div>
  )
}

function ProjectSelectionBar({
  selectedCount,
  busyAction,
  onClearSelection,
  onBulkDelete,
  selectedProjects,
}: {
  selectedCount: number
  busyAction: string | null
  onClearSelection: () => void
  onBulkDelete: (projects: ProjectSummary[]) => void
  selectedProjects: ProjectSummary[]
}) {
  if (selectedCount === 0) return null

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-y border-[#b7cbc0] bg-[#e8f2ec] px-3 py-2.5 sm:px-4">
      <p className="text-xs font-semibold text-[#1d6b50]">{selectedCount}件を選択しています</p>
      <div className="flex items-center gap-1.5">
        <button
          className="rounded-md px-2.5 py-1.5 text-[10px] font-semibold text-[#53615b] transition hover:bg-[#fbfcfa] hover:text-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25"
          type="button"
          onClick={onClearSelection}
        >
          選択解除
        </button>
        <button
          className="inline-flex items-center gap-1.5 rounded-md bg-[#b6533a] px-2.5 py-1.5 text-[10px] font-semibold text-[#fffaf7] transition hover:bg-[#963d2a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b6533a]/25 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={() => onBulkDelete(selectedProjects)}
          disabled={Boolean(busyAction)}
        >
          <Trash2 size={12} />
          選択したプロジェクトを削除
        </button>
      </div>
    </div>
  )
}

function ProjectListPanel({
  projectEntries,
  invalidEntries,
  filteredProjectEntries,
  visibleProjectEntries,
  visibleProjectIds,
  selectedProjectIds,
  normalizedSearchQuery,
  showAllProjects,
  areAllVisibleSelected,
  hasHiddenProjects,
  busyAction,
  onSelectVisible,
  onShowAllProjects,
  onRefresh,
  onSelectProject,
  onOpen,
  onRelink,
  onDelete,
}: {
  projectEntries: ProjectEntry[]
  invalidEntries: InvalidProjectEntry[]
  filteredProjectEntries: ProjectEntry[]
  visibleProjectEntries: ProjectEntry[]
  visibleProjectIds: string[]
  selectedProjectIds: Set<string>
  normalizedSearchQuery: string
  showAllProjects: boolean
  areAllVisibleSelected: boolean
  hasHiddenProjects: boolean
  busyAction: string | null
  onSelectVisible: (projectIds: string[]) => void
  onShowAllProjects: () => void
  onRefresh: () => void
  onSelectProject: (projectId: string) => void
  onOpen: (projectId: string) => void
  onRelink: (projectId: string) => void
  onDelete: (summary: ProjectSummary) => void
}) {
  return (
    <div className="mt-10 overflow-hidden rounded-[14px] border border-[#b7cbc0] bg-[#fbfcfa] shadow-[0_18px_52px_rgba(22,54,42,0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8e1dc] px-4 py-3 sm:px-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">
          {normalizedSearchQuery
            ? `${filteredProjectEntries.length} SEARCH RESULT${filteredProjectEntries.length === 1 ? '' : 'S'}`
            : showAllProjects
              ? `${projectEntries.length} PROJECT${projectEntries.length === 1 ? '' : 'S'}`
              : `RECENT ${visibleProjectEntries.length} / ${projectEntries.length}`}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {visibleProjectIds.length > 0 && (
            <button
              className="rounded-md px-2 py-1.5 text-[10px] font-semibold text-[#71807b] transition hover:bg-[#e2eee8] hover:text-[#1d6b50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              onClick={() => onSelectVisible(visibleProjectIds)}
              disabled={Boolean(busyAction)}
            >
              {areAllVisibleSelected ? '表示中の選択を解除' : '表示中をすべて選択'}
            </button>
          )}
          {!normalizedSearchQuery && hasHiddenProjects && (
            <button
              className="rounded-md px-2 py-1.5 text-[10px] font-semibold text-[#1d6b50] transition hover:bg-[#e2eee8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              onClick={onShowAllProjects}
              disabled={Boolean(busyAction)}
            >
              過去のプロジェクトも表示
            </button>
          )}
          <button
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] font-semibold text-[#71807b] transition hover:bg-[#e2eee8] hover:text-[#1d6b50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={onRefresh}
            disabled={Boolean(busyAction)}
          >
            <RefreshCw size={12} />
            更新
          </button>
        </div>
      </div>
      {visibleProjectEntries.map(({ summary }) => (
        <ProjectRow
          key={summary.id}
          summary={summary}
          busy={busyAction === summary.id || busyAction === 'delete'}
          selected={selectedProjectIds.has(summary.id)}
          onSelect={() => onSelectProject(summary.id)}
          onOpen={() => onOpen(summary.id)}
          onRelink={() => onRelink(summary.id)}
          onDelete={() => onDelete(summary)}
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
      {hasHiddenProjects && !normalizedSearchQuery && (
        <div className="flex items-center justify-center border-b border-[#d8e1dc] px-4 py-3 sm:px-5">
          <button
            className="text-xs font-semibold text-[#1d6b50] underline decoration-[#b7cbc0] underline-offset-4 transition hover:text-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25"
            type="button"
            onClick={onShowAllProjects}
          >
            残り {filteredProjectEntries.length - visibleProjectEntries.length} 件を表示
          </button>
        </div>
      )}
    </div>
  )
}

function HomeContent({
  isLoading,
  projectEntries,
  invalidEntries,
  filteredProjectEntries,
  visibleProjectEntries,
  visibleProjectIds,
  selectedProjects,
  selectedProjectIds,
  searchQuery,
  normalizedSearchQuery,
  showAllProjects,
  areAllVisibleSelected,
  hasHiddenProjects,
  busyAction,
  onCreateProject,
  onSearchChange,
  onClearSelection,
  onBulkDelete,
  onSelectVisible,
  onShowAllProjects,
  onRefresh,
  onSelectProject,
  onOpen,
  onRelink,
  onDelete,
}: {
  isLoading: boolean
  projectEntries: ProjectEntry[]
  invalidEntries: InvalidProjectEntry[]
  filteredProjectEntries: ProjectEntry[]
  visibleProjectEntries: ProjectEntry[]
  visibleProjectIds: string[]
  selectedProjects: ProjectSummary[]
  selectedProjectIds: Set<string>
  searchQuery: string
  normalizedSearchQuery: string
  showAllProjects: boolean
  areAllVisibleSelected: boolean
  hasHiddenProjects: boolean
  busyAction: string | null
  onCreateProject: () => void
  onSearchChange: (value: string) => void
  onClearSelection: () => void
  onBulkDelete: (projects: ProjectSummary[]) => void
  onSelectVisible: (projectIds: string[]) => void
  onShowAllProjects: () => void
  onRefresh: () => void
  onSelectProject: (projectId: string) => void
  onOpen: (projectId: string) => void
  onRelink: (projectId: string) => void
  onDelete: (summary: ProjectSummary) => void
}) {
  if (isLoading) {
    return (
      <div className="mt-10 flex items-center justify-center gap-2 py-20 text-xs text-[#71807b]" aria-live="polite">
        <RefreshCw className="animate-spin" size={15} />
        プロジェクトを確認しています…
      </div>
    )
  }

  if (projectEntries.length === 0 && invalidEntries.length === 0) {
    return (
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
    )
  }

  if (filteredProjectEntries.length === 0 && normalizedSearchQuery) {
    return (
      <div className="mt-10 flex flex-col items-center border-y border-dashed border-[#b7cbc0] px-6 py-16 text-center">
        <Search className="text-[#9aada3]" size={29} strokeWidth={1.4} />
        <h2 className="mt-4 text-[17px] font-semibold tracking-[-0.03em]">検索結果がありません</h2>
        <p className="mt-2 max-w-[360px] text-xs leading-6 text-[#71807b]">別のキーワードで検索するか、検索条件をクリアしてください。</p>
        <button
          className="mt-5 rounded-[8px] border border-[#b7cbc0] px-3 py-2 text-xs font-semibold text-[#1d6b50] transition hover:border-[#1d6b50] hover:bg-[#e2eee8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25"
          type="button"
          onClick={() => onSearchChange('')}
        >
          検索をクリア
        </button>
      </div>
    )
  }

  return (
    <>
      {projectEntries.length > 0 && (
        <ProjectSearchTools
          searchQuery={searchQuery}
          normalizedSearchQuery={normalizedSearchQuery}
          projectCount={projectEntries.length}
          filteredCount={filteredProjectEntries.length}
          selectedCount={selectedProjects.length}
          onSearchChange={onSearchChange}
        />
      )}
      <ProjectSelectionBar
        selectedCount={selectedProjects.length}
        busyAction={busyAction}
        onClearSelection={onClearSelection}
        onBulkDelete={onBulkDelete}
        selectedProjects={selectedProjects}
      />
      <ProjectListPanel
        projectEntries={projectEntries}
        invalidEntries={invalidEntries}
        filteredProjectEntries={filteredProjectEntries}
        visibleProjectEntries={visibleProjectEntries}
        visibleProjectIds={visibleProjectIds}
        selectedProjectIds={selectedProjectIds}
        normalizedSearchQuery={normalizedSearchQuery}
        showAllProjects={showAllProjects}
        areAllVisibleSelected={areAllVisibleSelected}
        hasHiddenProjects={hasHiddenProjects}
        busyAction={busyAction}
        onSelectVisible={onSelectVisible}
        onShowAllProjects={onShowAllProjects}
        onRefresh={onRefresh}
        onSelectProject={onSelectProject}
        onOpen={onOpen}
        onRelink={onRelink}
        onDelete={onDelete}
      />
    </>
  )
}

export function HomePage({
  onHome,
  onCreateProject,
  onOpenProject,
  onRelinkProject,
  onDeleteProject,
}: HomePageProps) {
  const [entries, setEntries] = useState<ProjectListEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DeleteRequest | null>(null)
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [showAllProjects, setShowAllProjects] = useState(false)

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
    setBusyAction(projectId)
    setError(null)
    try {
      await onOpenProject(projectId)
    } catch (openError) {
      setError(getErrorDetail(openError, 'プロジェクトを開けませんでした。'))
    } finally {
      setBusyAction(null)
    }
  }

  const handleRelink = async (projectId: string) => {
    setBusyAction(projectId)
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
      setBusyAction(null)
    }
  }

  const handleDelete = (summary: ProjectSummary) => {
    setError(null)
    setPendingDelete({ kind: 'single', projects: [summary] })
  }

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setShowAllProjects(false)
    setSelectedProjectIds(new Set())
  }

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectIds((current) => {
      const next = new Set(current)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }

  const handleSelectVisible = (projectIds: string[]) => {
    setSelectedProjectIds((current) => {
      const next = new Set(current)
      const areAllSelected = projectIds.every((projectId) => next.has(projectId))
      for (const projectId of projectIds) {
        if (areAllSelected) next.delete(projectId)
        else next.add(projectId)
      }
      return next
    })
  }

  const handleBulkDelete = (projects: ProjectSummary[]) => {
    if (projects.length === 0) return
    setError(null)
    setPendingDelete({ kind: 'bulk', projects })
  }

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return

    const projects = pendingDelete.projects
    setBusyAction('delete')
    setError(null)
    try {
      const results = await Promise.allSettled(
        projects.map((project) => onDeleteProject(project.id)),
      )
      const failures = results.filter((result) => result.status === 'rejected')
      const deletedProjects = projects.filter((_, index) => results[index]?.status === 'fulfilled')
      setSelectedProjectIds((current) => {
        const next = new Set(current)
        for (const project of deletedProjects) next.delete(project.id)
        return next
      })
      setPendingDelete(null)
      await refresh()
      if (failures.length > 0) {
        throw new Error(`${failures.length}件のプロジェクトを削除できませんでした。`)
      }
    } catch (deleteError) {
      setError(getErrorDetail(deleteError, 'プロジェクトを削除できませんでした。'))
    } finally {
      setBusyAction(null)
    }
  }

  const projectEntries = entries.filter(
    (entry): entry is Extract<ProjectListEntry, { kind: 'project' }> => entry.kind === 'project',
  )
  const invalidEntries = entries.filter((entry) => entry.kind === 'invalid')
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase()
  const filteredProjectEntries = normalizedSearchQuery
    ? projectEntries.filter(({ summary }) =>
        [summary.title, summary.sourceName, summary.sourcePath].some((value) =>
          value.toLocaleLowerCase().includes(normalizedSearchQuery),
        ),
      )
    : projectEntries
  const visibleProjectEntries = showAllProjects || normalizedSearchQuery
    ? filteredProjectEntries
    : filteredProjectEntries.slice(0, RECENT_PROJECT_LIMIT)
  const visibleProjectIds = visibleProjectEntries.map(({ summary }) => summary.id)
  const selectedProjects: ProjectSummary[] = []
  for (const { summary } of projectEntries) {
    if (selectedProjectIds.has(summary.id)) selectedProjects.push(summary)
  }
  const areAllVisibleSelected =
    visibleProjectIds.length > 0 && visibleProjectIds.every((projectId) => selectedProjectIds.has(projectId))
  const hasHiddenProjects = visibleProjectEntries.length < filteredProjectEntries.length
  const isDeleting = busyAction === 'delete'

  return (
    <main className="flex min-h-svh flex-col bg-[#f4f7f4] font-[Avenir_Next,Hiragino_Sans,Yu_Gothic,system-ui,sans-serif] text-[18px] leading-[1.45] tracking-[0.18px] text-[#18211f]">
      <AppHeader onHome={onHome} />
      <section className="mx-auto flex w-[calc(100%-48px)] max-w-[1040px] flex-1 flex-col pb-12 pt-12 md:w-[calc(100%-11.6vw)] md:pt-16">
        <div className="flex justify-end">
          <button
            className="inline-flex items-center gap-2 rounded-[9px] bg-[#1d6b50] px-4 py-3 text-xs font-semibold text-[#f3faf6] shadow-[0_7px_16px_rgba(29,107,80,0.17)] transition hover:bg-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2"
            type="button"
            onClick={onCreateProject}
          >
            <Plus size={15} />
            新規作成
          </button>
        </div>

        {error && (
          <div className="mt-6 flex items-start gap-2 rounded-[9px] border border-[#d6a18f] bg-[#fff8f5] px-4 py-3 text-xs text-[#a4573e]" role="alert">
            <AlertTriangle className="mt-0.5 shrink-0" size={14} />
            <span>{error}</span>
          </div>
        )}

        <HomeContent
          isLoading={isLoading}
          projectEntries={projectEntries}
          invalidEntries={invalidEntries}
          filteredProjectEntries={filteredProjectEntries}
          visibleProjectEntries={visibleProjectEntries}
          visibleProjectIds={visibleProjectIds}
          selectedProjects={selectedProjects}
          selectedProjectIds={selectedProjectIds}
          searchQuery={searchQuery}
          normalizedSearchQuery={normalizedSearchQuery}
          showAllProjects={showAllProjects}
          areAllVisibleSelected={areAllVisibleSelected}
          hasHiddenProjects={hasHiddenProjects}
          busyAction={busyAction}
          onCreateProject={onCreateProject}
          onSearchChange={handleSearchChange}
          onClearSelection={() => setSelectedProjectIds(new Set())}
          onBulkDelete={handleBulkDelete}
          onSelectVisible={handleSelectVisible}
          onShowAllProjects={() => setShowAllProjects(true)}
          onRefresh={() => void refresh()}
          onSelectProject={handleSelectProject}
          onOpen={(projectId) => void handleOpen(projectId)}
          onRelink={(projectId) => void handleRelink(projectId)}
          onDelete={handleDelete}
        />
      </section>
      {pendingDelete && (
        <DeleteProjectDialog
          request={pendingDelete}
          isDeleting={isDeleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void handleConfirmDelete()}
        />
      )}
    </main>
  )
}
