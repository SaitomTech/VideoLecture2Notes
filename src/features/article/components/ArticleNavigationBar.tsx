import { ArrowLeft, ArrowLeftRight } from 'lucide-react'
import { useState } from 'react'
import type { MediaProject } from '../../../types/project'
import { ArticleSwitcherPanel } from './ArticleSwitcherPanel'

type ArticleNavigationBarProps = {
  project: MediaProject
  onBack: () => void
  onSelect: (articleId: string) => void | boolean | Promise<void | boolean>
  disabled?: boolean
}

export function ArticleNavigationBar({
  project,
  onBack,
  onSelect,
  disabled = false,
}: ArticleNavigationBarProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleSelect = async (articleId: string) => {
    const result = await onSelect(articleId)
    if (result !== false) setIsOpen(false)
  }

  return (
    <>
      <div className="flex w-full items-center justify-between gap-3">
        <button
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-xs font-semibold text-[#71807b] transition hover:bg-[#e2eee8] hover:text-[#1d6b50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={onBack}
          disabled={disabled}
        >
          <ArrowLeft size={14} strokeWidth={1.8} aria-hidden="true" />
          プロジェクト詳細へ戻る
        </button>
        <button
          className="inline-flex shrink-0 items-center gap-2 rounded-[8px] border border-[#b7cbc0] bg-white px-3 py-2 text-xs font-semibold text-[#1d6b50] transition hover:border-[#1d6b50] hover:bg-[#e2eee8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={() => setIsOpen(true)}
          disabled={disabled}
        >
          <ArrowLeftRight size={14} />
          記事を切り替える
          <span className="font-mono text-[10px] text-[#71807b]">{project.articles.length}</span>
        </button>
      </div>
      {isOpen && (
        <ArticleSwitcherPanel
          project={project}
          selectedArticleId={project.activeArticleId}
          disabled={disabled}
          onClose={() => setIsOpen(false)}
          onSelect={handleSelect}
        />
      )}
    </>
  )
}
