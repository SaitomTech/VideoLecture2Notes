import { Download, Video } from 'lucide-react'

type VideoDropZoneProps = {
  isDragging: boolean
  onChoose: () => void | Promise<void>
  onYoutubeClick?: () => void
}

export function VideoDropZone({ isDragging, onChoose, onYoutubeClick }: VideoDropZoneProps) {
  return (
    <div
      className={`group relative mx-auto flex min-h-[250px] w-full max-w-[720px] flex-col items-center justify-center rounded-[14px] border border-dashed border-[#a6bcb0] bg-[#fbfcfa]/64 p-6 pb-10 text-center transition-[border-color,background-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[#1d6b50] hover:bg-[#e2eee8]/72 hover:shadow-[0_22px_70px_rgba(22,54,42,0.09)] ${isDragging ? 'border-[#1d6b50] bg-[#e2eee8]/72 shadow-[0_22px_70px_rgba(22,54,42,0.09)]' : ''}`}
    >
      <Video className="mb-4 text-[#7f9d90]" size={36} strokeWidth={1.55} aria-hidden="true" />
      <div className="text-[18px] font-semibold tracking-[-0.05em] text-[#18211f]">
        動画をここにドロップ
      </div>
      <div className="mt-2 text-xs text-[#71807b]">または</div>
      <button
        className="mt-3 rounded-[8px] bg-[#1d6b50] px-5 py-2.5 text-sm font-semibold text-[#f3faf6] shadow-[0_7px_16px_rgba(29,107,80,0.17)] transition hover:-translate-y-0.5 hover:bg-[#174d3c] hover:shadow-[0_9px_20px_rgba(29,107,80,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2"
        type="button"
        onClick={() => void onChoose()}
      >
        Finderで選択
      </button>
      <div className="mt-4 font-mono text-[9px] tracking-[0.06em] text-[#9baaa3]">
        MP4&nbsp; · &nbsp;MOV&nbsp; · &nbsp;M4V&nbsp; · &nbsp;MKV&nbsp; · &nbsp;WEBM
      </div>
      {onYoutubeClick && (
        <>
          <div className="mt-5 h-px w-[200px] bg-[#d8e1dc]" />
          <button
            className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[#71807b] underline decoration-[#b7cbc0] underline-offset-4 transition hover:text-[#1d6b50] hover:decoration-[#1d6b50]"
            type="button"
            onClick={onYoutubeClick}
          >
            <Download size={15} strokeWidth={1.7} />
            YouTubeからダウンロード…
          </button>
        </>
      )}
    </div>
  )
}
