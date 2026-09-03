import { FolderOpen } from 'lucide-react'
import { AppIcon } from './AppIcon'

type AppHeaderProps = {
  onOpenProjects?: () => void
  projectsDisabled?: boolean
}

export function AppHeader({ onOpenProjects, projectsDisabled = false }: AppHeaderProps) {
  return (
    <header className="flex h-[76px] items-center justify-between border-b border-[#d8e1dc]/75 px-[5.8vw]">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center overflow-visible">
          <AppIcon className="h-12 w-12" alt="Video Lecture to Notes" />
        </span>
        <span className="text-[15px] font-bold tracking-[-0.02em]">Video Lecture to Notes</span>
      </div>
      {onOpenProjects && (
        <button
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-semibold text-[#71807b] transition hover:bg-[#e2eee8] hover:text-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-45"
          type="button"
          onClick={onOpenProjects}
          disabled={projectsDisabled}
        >
          <FolderOpen size={14} />
          プロジェクト一覧
        </button>
      )}
    </header>
  )
}
