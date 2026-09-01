import { AppIcon } from './AppIcon'

export function AppHeader() {
  return (
    <header className="flex h-[76px] items-center border-b border-[#d8e1dc]/75 px-[5.8vw]">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center overflow-visible">
          <AppIcon className="h-12 w-12" alt="Video Lecture to Notes" />
        </span>
        <span className="text-[15px] font-bold tracking-[-0.02em]">Video Lecture to Notes</span>
      </div>
    </header>
  )
}
