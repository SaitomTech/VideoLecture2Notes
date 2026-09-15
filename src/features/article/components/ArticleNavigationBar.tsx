import { ArrowLeftRight } from 'lucide-react'
import { useState } from 'react'
import type { MediaProject } from '../../../types/project'
import { ArticleSwitcherPanel } from './ArticleSwitcherPanel'

type ArticleNavigationBarProps = {
  project: MediaProject
  onSelect: (articleId: string) => void | boolean | Promise<void | boolean>
  disabled?: boolean
}

export function ArticleNavigationBar({
  project,
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
      <button
        className="inline-flex shrink-0 items-center gap-2 rounded-[8px] border border-[#b7cbc0] bg-[#fbfcfa] px-3 py-2 text-xs font-semibold text-[#1d6b50] transition hover:border-[#1d6b50] hover:bg-[#e2eee8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
      >
        <ArrowLeftRight size={14} />
        記事を切り替える
        <span className="font-mono text-[10px] text-[#71807b]">{project.articles.length}</span>
      </button>
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
