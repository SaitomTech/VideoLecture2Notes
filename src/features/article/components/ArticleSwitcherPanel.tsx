import { CheckCircle2, Clock3, Film, LoaderCircle, X } from 'lucide-react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { useState } from 'react'
import { useDialogA11y } from '../../../lib/ui/useDialogA11y'
import { formatTimestamp } from '../../../lib/time'
import type { Article, MediaProject } from '../../../types/project'

type ArticleSwitcherPanelProps = {
  project: MediaProject
  onClose: () => void
  onSelect: (articleId: string) => void | Promise<void>
  selectedArticleId?: string
  disabled?: boolean
}

function ArticleThumbnail({ article }: { article: Article }) {
  const [failedPaths, setFailedPaths] = useState<string[]>([])
  const imagePaths = [
    article.inputMedia.thumbnailPath,
    ...article.slides.map((slide) => slide.image.representativeFramePath),
  ].filter((path): path is string => Boolean(path))
  const imagePath = imagePaths.find((path) => !failedPaths.includes(path))

  return (
    <div className="grid h-12 w-[76px] shrink-0 place-items-center overflow-hidden rounded-[7px] border border-[#d8e1dc] bg-[#e8f2ec]">
      {imagePath ? (
        <img
          className="h-full w-full object-cover"
          src={convertFileSrc(imagePath)}
          alt=""
          loading="lazy"
          onError={() => setFailedPaths((current) => [...new Set([...current, imagePath])])}
        />
      ) : (
        <Film className="text-[#8da79a]" size={18} strokeWidth={1.4} />
      )}
    </div>
  )
}

function articleStatus(article: Article) {
  if (article.workflow.maxReachedStep === 'export') {
    return {
      label: '完了',
      className: 'bg-[#e8f2ec] text-[#1d6b50]',
      icon: CheckCircle2,
    }
  }
  if (article.workflow.lastVisitedStep === 'detect-slides' && !article.slideDetection) {
    return {
      label: '未着手',
      className: 'bg-[#f1f3f1] text-[#71807b]',
      icon: Clock3,
    }
  }
  return {
    label: '作業途中',
    className: 'bg-[#fff2cf] text-[#9a7a35]',
    icon: LoaderCircle,
  }
}

export function ArticleSwitcherPanel({
  project,
  onClose,
  onSelect,
  selectedArticleId,
  disabled = false,
}: ArticleSwitcherPanelProps) {
  const dialogRef = useDialogA11y({ open: true, onClose, closeDisabled: disabled })

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-0 grid h-full w-full max-w-none place-items-center border-0 bg-[#18211f]/35 p-5 backdrop:bg-transparent"
      open
      aria-modal="true"
      aria-labelledby="article-switcher-title"
    >
      <section className="flex max-h-[calc(100vh-40px)] w-full max-w-[520px] flex-col overflow-hidden rounded-[16px] border border-[#b7cbc0] bg-[#fbfcfa] shadow-[0_24px_70px_rgba(24,33,31,0.2)]">
        <header className="flex items-start justify-between gap-3 border-b border-[#d8e1dc] px-5 py-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">
              ARTICLE SWITCHER
            </p>
            <h2
              id="article-switcher-title"
              className="mt-1 text-[19px] font-bold tracking-[-0.04em]"
            >
              作成・編集する記事を切り替え
            </h2>
            <p className="mt-1 text-xs text-[#71807b]">作成・編集する記事を選択してください。</p>
          </div>
          <button
            className="rounded-md p-1.5 text-[#71807b] transition hover:bg-[#e8f2ec] hover:text-[#53615b] disabled:cursor-not-allowed disabled:opacity-40"
            type="button"
            onClick={onClose}
            disabled={disabled}
            aria-label="記事の切り替えを閉じる"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-2" role="listbox" aria-label="作成・編集する記事の切り替え">
            {project.articles.map((article) => {
              const status = articleStatus(article)
              const StatusIcon = status.icon
              const isSelected = article.id === selectedArticleId
              return (
                <button
                  className={`flex w-full items-center gap-3 rounded-[10px] border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-55 ${isSelected ? 'border-[#1d6b50] bg-[#eef6f0] shadow-[0_0_0_1px_rgba(29,107,80,0.12)]' : 'border-[#d8e1dc] bg-white hover:border-[#9fc3b0] hover:bg-[#f7fbf8]'}`}
                  key={article.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={disabled}
                  onClick={() => {
                    if (isSelected) onClose()
                    else void onSelect(article.id)
                  }}
                >
                  <ArticleThumbnail article={article} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#18211f]">
                      {article.title}
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-[10px] text-[#71807b]">
                      <span>{formatTimestamp(article.inputMedia.metadata.durationMs)}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold ${status.className}`}
                      >
                        <StatusIcon size={11} strokeWidth={2} />
                        {status.label}
                      </span>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <footer className="border-t border-[#d8e1dc] px-5 py-4">
          <p className="text-[11px] leading-5 text-[#71807b]">
            下書きは記事ごとに保存されます。別の記事へ移動しても内容は失われません。記事を選択すると、この編集画面の内容が切り替わります。
          </p>
        </footer>
      </section>
    </dialog>
  )
}
