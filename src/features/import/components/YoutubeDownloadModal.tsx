import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

type YoutubeDownloadModalProps = {
  children: ReactNode
  closeDisabled?: boolean
  onClose: () => void
}

export function YoutubeDownloadModal({
  children,
  closeDisabled = false,
  onClose,
}: YoutubeDownloadModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeDisabledRef = useRef(closeDisabled)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    closeDisabledRef.current = closeDisabled
  }, [closeDisabled])

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !closeDisabledRef.current) onCloseRef.current()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [])

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
        className="w-full max-w-[560px] overflow-hidden rounded-[14px] border border-[#d8e1dc] bg-[#fbfcfa] shadow-[0_24px_70px_rgba(22,54,42,0.2)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="youtube-download-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-5 border-b border-[#d8e1dc] px-5 py-5 sm:px-7 sm:py-6">
          <div>
            <h2 id="youtube-download-title" className="text-[18px] font-bold tracking-[-0.04em]">
              YouTubeからダウンロード
            </h2>
            <p className="mt-1.5 text-xs leading-5 text-[#71807b]">
              動画をダウンロードして、そのまま読み込みます。
            </p>
          </div>
          <button
            className="-mr-2 -mt-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px] text-[#71807b] transition hover:bg-[#eef5f0] hover:text-[#1d6b50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25 disabled:cursor-not-allowed disabled:opacity-40"
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="YouTubeダウンロードを閉じる"
          >
            <X size={19} strokeWidth={1.7} aria-hidden="true" />
          </button>
        </header>
        <div className="px-5 py-5 sm:px-7 sm:py-6">{children}</div>
      </div>
    </div>
  )
}
