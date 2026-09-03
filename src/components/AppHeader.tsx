import { AppIcon } from './AppIcon'

type AppHeaderProps = {
  onHome?: () => void
  homeDisabled?: boolean
}

const appBrand = (
  <>
    <span className="grid h-10 w-10 place-items-center overflow-visible">
      <AppIcon className="h-12 w-12" alt="Video Lecture to Notes" />
    </span>
    <span className="text-[15px] font-bold tracking-[-0.02em]">Video Lecture to Notes</span>
  </>
)

export function AppHeader({ onHome, homeDisabled = false }: AppHeaderProps) {
  return (
    <header className="flex h-[76px] items-center justify-between border-b border-[#d8e1dc]/75 px-[5.8vw]">
      {onHome ? (
        <button
          className="inline-flex cursor-pointer items-center gap-3 rounded-[9px] px-1.5 py-1 text-left transition hover:bg-[#e2eee8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-45"
          type="button"
          onClick={onHome}
          disabled={homeDisabled}
          aria-label="プロジェクトトップへ戻る"
        >
          {appBrand}
        </button>
      ) : (
        <div className="flex items-center gap-3">{appBrand}</div>
      )}
    </header>
  )
}
