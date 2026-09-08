import { Download, RefreshCw, Scale } from 'lucide-react'
import { useState } from 'react'
import { getUpdateMessage, useUpdates } from '../lib/updateContext'
import { AppIcon } from './AppIcon'
import { LicenseDialog } from './LicenseDialog'

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
  const updates = useUpdates()
  const { update, phase, progress, autoCheck, setAutoCheck, checkForUpdates, installUpdate } =
    updates
  const [isLicenseDialogOpen, setIsLicenseDialogOpen] = useState(false)
  const isUpdateBusy = phase === 'checking' || phase === 'downloading' || phase === 'installing'
  const isInstallingUpdate = phase === 'downloading' || phase === 'installing'
  const updateMessage = getUpdateMessage(updates)

  return (
    <header className="flex h-[76px] items-center justify-between border-b border-[#d8e1dc]/75 px-[5.8vw]">
      {onHome ? (
        <button
          className="inline-flex cursor-pointer items-center gap-3 rounded-[9px] px-1.5 py-1 text-left transition hover:bg-[#e2eee8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-45"
          type="button"
          onClick={onHome}
          disabled={homeDisabled || isInstallingUpdate}
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
        {update && (
          <button
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[8px] border border-[#c9ddd2] bg-[#f7fbf8] px-2.5 py-2 text-[11px] font-semibold text-[#1d6b50] transition hover:bg-[#e8f2ec] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25"
            type="button"
            onClick={() => {
              if (!homeDisabled) void installUpdate()
            }}
            disabled={isUpdateBusy || homeDisabled}
          >
            <Download size={13} />
            {phase === 'installed' ? '再起動' : 'インストールして再起動'}
          </button>
        )}
        <label
          className="hidden shrink-0 cursor-pointer items-center gap-1 text-[11px] font-semibold text-[#53615b] sm:inline-flex"
          title="次回起動から自動確認の設定が適用されます。更新はボタンから実行します"
        >
          <input
            className="accent-[#1d6b50]"
            type="checkbox"
            checked={autoCheck}
            onChange={(event) => setAutoCheck(event.target.checked)}
          />
          更新を自動確認
        </label>
        <button
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[8px] px-2.5 py-2 text-[11px] font-semibold text-[#53615b] transition hover:bg-[#e8f2ec] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={() => void checkForUpdates()}
          disabled={isUpdateBusy || phase === 'installed'}
          title="アップデートを確認"
        >
          <RefreshCw className={isUpdateBusy ? 'animate-spin' : ''} size={13} />
          {isInstallingUpdate && progress !== null ? `${progress}%` : '更新を確認'}
        </button>
        <button
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[8px] px-2.5 py-2 text-[11px] font-semibold text-[#53615b] transition hover:bg-[#e8f2ec] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25"
          type="button"
          onClick={() => setIsLicenseDialogOpen(true)}
          title="ライセンス情報を表示"
          aria-label="ライセンス情報を表示"
        >
          <Scale size={13} />
          <span className="hidden sm:inline">ライセンス</span>
        </button>
      </div>
      {isLicenseDialogOpen && <LicenseDialog onClose={() => setIsLicenseDialogOpen(false)} />}
    </header>
  )
}
