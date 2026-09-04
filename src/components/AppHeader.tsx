import { ExternalLink, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { getErrorDetail } from '../lib/errors'
import { checkForUpdates, openUpdateRelease, type UpdateCheckResult } from '../lib/updates'
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
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false)
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null)
  const [updateMessage, setUpdateMessage] = useState<string | null>(null)

  const handleCheckForUpdates = async () => {
    setIsCheckingForUpdates(true)
    setUpdateMessage(null)
    try {
      const result = await checkForUpdates()
      setUpdateResult(result)
      setUpdateMessage(
        result.available
          ? `新しいバージョン v${result.latestVersion} があります。`
          : `最新版です（v${result.currentVersion}）。`,
      )
    } catch (error) {
      setUpdateResult(null)
      setUpdateMessage(getErrorDetail(error, 'アップデートを確認できませんでした。'))
    } finally {
      setIsCheckingForUpdates(false)
    }
  }

  const handleOpenUpdateRelease = async () => {
    if (!updateResult?.available) return

    try {
      await openUpdateRelease(updateResult.releaseUrl)
    } catch (error) {
      setUpdateMessage(getErrorDetail(error, 'GitHub Releaseを開けませんでした。'))
    }
  }

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
      <div className="flex min-w-0 items-center gap-2">
        {updateMessage && (
          <span
            className="hidden max-w-[230px] truncate text-[11px] text-[#53615b] sm:inline"
            role="status"
            aria-live="polite"
          >
            {updateMessage}
          </span>
        )}
        {updateResult?.available && (
          <button
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[8px] border border-[#c9ddd2] bg-[#f7fbf8] px-2.5 py-2 text-[11px] font-semibold text-[#1d6b50] transition hover:bg-[#e8f2ec] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25"
            type="button"
            onClick={() => void handleOpenUpdateRelease()}
          >
            <ExternalLink size={13} />
            v{updateResult.latestVersion}をダウンロード
          </button>
        )}
        <button
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[8px] px-2.5 py-2 text-[11px] font-semibold text-[#53615b] transition hover:bg-[#e8f2ec] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={() => void handleCheckForUpdates()}
          disabled={isCheckingForUpdates}
          title="アップデートを確認"
        >
          <RefreshCw className={isCheckingForUpdates ? 'animate-spin' : ''} size={13} />
          更新を確認
        </button>
      </div>
    </header>
  )
}
