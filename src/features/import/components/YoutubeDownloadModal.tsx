import { X } from 'lucide-react'
import { type ReactNode } from 'react'
import { useDialogA11y } from '../../../lib/ui/useDialogA11y'

type YoutubeDownloadModalProps = {
  children: ReactNode
  closeDisabled?: boolean
  onClose: () => void
  title?: string
  description?: string
  closeLabel?: string
}

export function YoutubeDownloadModal({
  children,
  closeDisabled = false,
  onClose,
  title = 'YouTubeからダウンロード',
  description = '動画をダウンロードして、そのままプロジェクトへ追加します。',
  closeLabel = 'YouTubeダウンロードを閉じる',
}: YoutubeDownloadModalProps) {
  const dialogRef = useDialogA11y<HTMLDivElement>({ open: true, onClose, closeDisabled })

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#14231d]/25 px-4 py-14 sm:py-20"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-[560px] overflow-hidden rounded-[14px] border border-[#d8e1dc] bg-[#fbfcfa] shadow-[0_24px_70px_rgba(22,54,42,0.2)] outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-import-modal-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-5 border-b border-[#d8e1dc] px-5 py-5 sm:px-7 sm:py-6">
          <div>
            <h2 id="video-import-modal-title" className="text-[18px] font-bold tracking-[-0.04em]">
              {title}
            </h2>
            <p className="mt-1.5 text-xs leading-5 text-[#71807b]">{description}</p>
          </div>
          <button
            className="-mr-2 -mt-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px] text-[#71807b] transition hover:bg-[#eef5f0] hover:text-[#1d6b50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25 disabled:cursor-not-allowed disabled:opacity-40"
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label={closeLabel}
          >
            <X size={19} strokeWidth={1.7} aria-hidden="true" />
          </button>
        </header>
        <div className="px-5 py-5 sm:px-7 sm:py-6">{children}</div>
      </div>
    </div>
  )
}
