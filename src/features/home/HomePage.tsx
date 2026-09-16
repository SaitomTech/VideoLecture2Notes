import { ArrowRight, FileVideo, Plus, RefreshCw, Search, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { AppHeader } from '../../components/AppHeader'
import { getErrorDetail } from '../../lib/errors'
import { listProjects } from '../../lib/storage/projectStorage'
import { useDialogA11y } from '../../lib/ui/useDialogA11y'
import type { ProjectListEntry, ProjectSummary } from '../../types/project'

type HomePageProps = {
  onCreateProject: (title: string) => Promise<void>
  onOpenProject: (projectId: string) => Promise<void>
}

function ProjectThumbnail({ summary }: { summary: ProjectSummary }) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const source = summary.thumbnailPath ? convertFileSrc(summary.thumbnailPath) : null

  return (
    <div className="grid aspect-video w-full shrink-0 place-items-center overflow-hidden rounded-[9px] border border-[#d8e1dc] bg-[#e8f2ec] sm:w-[170px]">
      {source && source !== failedSource ? (
        <img
          className="h-full w-full object-cover"
          src={source}
          alt=""
          onError={() => setFailedSource(source)}
        />
      ) : (
        <FileVideo className="text-[#8da79a]" size={26} strokeWidth={1.4} />
      )}
    </div>
  )
}

function ProjectRow({
  summary,
  onOpen,
  isOpening,
  isDisabled,
}: {
  summary: ProjectSummary
  onOpen: () => void
  isOpening: boolean
  isDisabled: boolean
}) {
  return (
    <article className="flex flex-col gap-4 border-b border-[#d8e1dc] px-5 py-5 transition hover:bg-[#f4f7f4]/70 sm:flex-row sm:items-center">
      <ProjectThumbnail summary={summary} />
      <div className="min-w-0 flex-1">
        <div>
          <span className="flex w-fit items-center rounded-full border border-[#d8cfee] bg-[#f1eefb] px-2 py-1 text-[10px] font-semibold text-[#65508d]">
            プロジェクト
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <h2 className="truncate text-[16px] font-semibold tracking-[-0.03em] text-[#18211f]">
            {summary.title}
          </h2>
        </div>
        <p className="mt-1 truncate text-xs text-[#53615b]">
          {summary.videoCount}動画 · {summary.articleCount}記事
        </p>
        <p className="mt-2 font-mono text-[10px] text-[#71807b]">
          最終更新 {new Date(summary.updatedAt).toLocaleDateString('ja-JP')}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          className="inline-flex items-center gap-2 rounded-[8px] bg-[#1d6b50] px-3.5 py-2.5 text-xs font-semibold text-[#f3faf6] transition hover:bg-[#174d3c]"
          type="button"
          disabled={isDisabled}
          onClick={onOpen}
        >
          {isOpening ? <RefreshCw className="animate-spin" size={14} /> : '開く'}
          {!isOpening && <ArrowRight size={14} />}
        </button>
      </div>
    </article>
  )
}

export function HomePage({ onCreateProject, onOpenProject }: HomePageProps) {
  const [entries, setEntries] = useState<ProjectListEntry[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const createDialogRef = useDialogA11y({
    open: createOpen,
    onClose: () => setCreateOpen(false),
    closeDisabled: busy === 'create',
  })

  const refresh = useCallback(async () => {
    try {
      setEntries(await listProjects())
      setError(null)
    } catch (loadError) {
      setError(getErrorDetail(loadError, 'プロジェクト一覧を読み込めませんでした。'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Loading the external project index is the purpose of this effect.
    // eslint-disable-next-line react/set-state-in-effect
    void refresh()
  }, [refresh])

  const projects = entries.filter(
    (entry): entry is Extract<ProjectListEntry, { kind: 'project' }> => entry.kind === 'project',
  )
  const normalized = search.trim().toLocaleLowerCase()
  const filtered = projects.filter(
    ({ summary }) => !normalized || summary.title.toLocaleLowerCase().includes(normalized),
  )

  const create = async () => {
    if (!title.trim()) return
    setBusy('create')
    try {
      await onCreateProject(title.trim())
      setCreateOpen(false)
      setTitle('')
    } catch (createError) {
      setError(getErrorDetail(createError, 'プロジェクトを作成できませんでした。'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="flex min-h-svh flex-col bg-[#f4f7f4] font-[Avenir_Next,Hiragino_Sans,Yu_Gothic,system-ui,sans-serif] text-[#18211f]">
      <AppHeader />
      <section className="mx-auto flex w-[calc(100%-48px)] max-w-[1040px] flex-1 flex-col pb-14 pt-12 md:w-[calc(100%-11.6vw)] md:pt-16">
        <div className="flex justify-end">
          <button
            className="inline-flex items-center gap-2 rounded-[9px] bg-[#1d6b50] px-4 py-3 text-xs font-semibold text-[#f3faf6] shadow-[0_7px_16px_rgba(29,107,80,0.17)] hover:bg-[#174d3c]"
            type="button"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={15} /> 新規プロジェクト
          </button>
        </div>
        {error && (
          <p
            className="mt-5 rounded-[9px] border border-[#d6a18f] bg-[#fff8f5] px-4 py-3 text-xs text-[#a4573e]"
            role="alert"
          >
            {error}
          </p>
        )}
        <div className="mt-8 overflow-hidden rounded-[16px] border border-[#b7cbc0] bg-white shadow-[0_18px_52px_rgba(22,54,42,0.05)]">
          <div className="flex items-center justify-between gap-3 px-5 pt-5">
            <label className="relative block w-full max-w-[460px]">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa6a1]"
                size={15}
              />
              <input
                className="h-10 w-full rounded-[9px] border border-[#b7cbc0] bg-white pl-9 pr-3 text-xs outline-none placeholder:text-[#9aa6a1] focus:border-[#1d6b50]"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="プロジェクトを検索"
              />
            </label>
            <span className="font-mono text-[10px] text-[#71807b]">{filtered.length}件</span>
          </div>
          {loading ? (
            <div className="flex flex-1 items-center justify-center py-24 text-xs text-[#71807b]">
              <RefreshCw className="mr-2 animate-spin" size={15} />
              読み込み中…
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-10 flex flex-1 flex-col items-center justify-center border-y border-dashed border-[#b7cbc0] py-20 text-center">
              <FileVideo className="text-[#9aada3]" size={33} strokeWidth={1.3} />
              <h2 className="mt-4 text-[17px] font-semibold">
                {normalized ? '検索結果がありません' : 'まだプロジェクトがありません'}
              </h2>
              <p className="mt-2 text-xs leading-6 text-[#71807b]">
                {normalized
                  ? '別のキーワードで検索してください。'
                  : 'プロジェクトを作成して動画を追加しましょう。'}
              </p>
              <button
                className="mt-6 inline-flex items-center gap-2 rounded-[9px] border border-[#b7cbc0] bg-white px-4 py-3 text-xs font-semibold text-[#1d6b50] hover:bg-[#e2eee8]"
                type="button"
                onClick={() => setCreateOpen(true)}
              >
                <Plus size={14} /> プロジェクトを作成
              </button>
            </div>
          ) : (
            <div className="mt-6 overflow-hidden border-t border-[#d8e1dc]">
              {filtered.map(({ summary }) => (
                <ProjectRow
                  key={summary.id}
                  summary={summary}
                  isOpening={busy === `open:${summary.id}`}
                  isDisabled={busy?.startsWith('open:') === true}
                  onOpen={() => {
                    if (busy) return
                    setBusy(`open:${summary.id}`)
                    void onOpenProject(summary.id)
                      .catch((openError) =>
                        setError(getErrorDetail(openError, 'プロジェクトを開けませんでした。')),
                      )
                      .finally(() => setBusy(null))
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </section>
      {createOpen && (
        <dialog
          ref={createDialogRef}
          className="fixed inset-0 z-50 m-0 grid h-full w-full max-w-none place-items-center border-0 bg-[#18211f]/35 px-5 backdrop-blur-[2px]"
          open
          aria-labelledby="create-project-title"
        >
          <section className="w-full max-w-[430px] rounded-[16px] border border-[#b7cbc0] bg-white p-6 shadow-[0_24px_70px_rgba(24,33,31,0.2)]">
            <div className="flex items-center justify-between">
              <h2 id="create-project-title" className="text-[18px] font-bold">
                新規プロジェクト
              </h2>
              <button
                className="rounded-md p-1.5 text-[#71807b] hover:bg-[#e8f2ec]"
                type="button"
                onClick={() => setCreateOpen(false)}
                disabled={busy === 'create'}
                aria-label="新規プロジェクトを閉じる"
              >
                <X size={17} />
              </button>
            </div>
            <label className="mt-6 block text-xs font-semibold text-[#53615b]">
              プロジェクト名
              <input
                autoFocus
                className="mt-2 h-11 w-full rounded-[8px] border border-[#b7cbc0] bg-white px-3 text-sm outline-none focus:border-[#1d6b50]"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void create()
                }}
                placeholder="例：2026 春の講演会"
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                className="rounded-[8px] px-3 py-2.5 text-xs font-semibold text-[#71807b] hover:bg-[#eef3ef]"
                type="button"
                onClick={() => setCreateOpen(false)}
                disabled={busy === 'create'}
              >
                キャンセル
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-[8px] bg-[#1d6b50] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
                type="button"
                disabled={!title.trim() || busy === 'create'}
                onClick={() => void create()}
              >
                {busy === 'create' && <RefreshCw className="animate-spin" size={13} />}作成
              </button>
            </div>
          </section>
        </dialog>
      )}
    </main>
  )
}
