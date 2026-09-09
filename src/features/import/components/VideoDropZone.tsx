import { Download, Video } from 'lucide-react'

type VideoDropZoneProps = {
  isDragging: boolean
  disabled?: boolean
  onChoose: () => void | Promise<void>
  onYoutubeDownload: () => void
}

export function VideoDropZone({
  isDragging,
  disabled = false,
  onChoose,
  onYoutubeDownload,
}: VideoDropZoneProps) {
  return (
    <div
      className={`group relative flex min-h-[390px] flex-col items-center justify-center rounded-[18px] border border-dashed border-[#a6bcb0] bg-[#fbfcfa] p-8 text-center transition-[border-color,background-color,box-shadow] duration-200 sm:min-h-[430px] sm:p-12 ${disabled ? 'opacity-50' : 'hover:border-[#1d6b50] hover:bg-[#f7fbf8] hover:shadow-[0_22px_70px_rgba(22,54,42,0.07)]'} ${isDragging && !disabled ? 'border-[#1d6b50] bg-[#e2eee8]/72 shadow-[0_22px_70px_rgba(22,54,42,0.09)]' : ''}`}
    >
      <Video className="mb-6 text-[#78958b]" size={54} strokeWidth={1.25} aria-hidden="true" />
      <div className="text-[20px] font-semibold tracking-[-0.04em] text-[#18211f]">
        動画をここにドロップ
      </div>
      <div className="mt-2 text-xs leading-[1.45] text-[#71807b]">または</div>
      <button
        className="mt-5 inline-flex h-12 items-center justify-center rounded-[9px] bg-[#1d6b50] px-6 text-sm font-semibold text-[#f3faf6] shadow-[0_7px_16px_rgba(29,107,80,0.17)] transition hover:-translate-y-0.5 hover:bg-[#174d3c] hover:shadow-[0_9px_20px_rgba(29,107,80,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
        type="button"
        onClick={() => {
          if (!disabled) void onChoose()
        }}
        disabled={disabled}
      >
        {disabled ? '選択できません' : 'Finderで選択'}
      </button>
      <div className="mt-5 font-mono text-[9px] tracking-[0.06em] text-[#9baaa3]">
        MP4&nbsp; · &nbsp;MOV&nbsp; · &nbsp;M4V&nbsp; · &nbsp;MKV&nbsp; · &nbsp;WEBM
      </div>
      <div className="mt-8 border-t border-[#d8e1dc] pt-5">
        <button
          className="inline-flex items-center gap-1.5 rounded-[6px] px-2 py-1 text-[11px] font-semibold text-[#71807b] underline decoration-[#b7cbc0] underline-offset-4 transition hover:bg-[#eef5f0] hover:text-[#1d6b50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25 disabled:cursor-not-allowed disabled:opacity-45"
          type="button"
          onClick={onYoutubeDownload}
          disabled={disabled}
        >
          <Download size={14} strokeWidth={1.8} aria-hidden="true" />
          YouTubeからダウンロード…
        </button>
      </div>
    </div>
  )
}
