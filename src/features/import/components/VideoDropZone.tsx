import { FolderOpen, Link, Upload } from 'lucide-react'

type VideoDropZoneProps = {
  isDragging: boolean
  onChoose: () => void | Promise<void>
  onYoutubeClick?: () => void
}

export function VideoDropZone({ isDragging, onChoose, onYoutubeClick }: VideoDropZoneProps) {
  return (
    <div
      className={`group relative mx-auto flex min-h-[220px] w-full max-w-[720px] flex-col items-center justify-center rounded-[14px] border border-dashed border-[#a6bcb0] bg-[#fbfcfa]/64 p-6 text-center transition-[border-color,background-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[#1d6b50] hover:bg-[#e2eee8]/72 hover:shadow-[0_22px_70px_rgba(22,54,42,0.09)] ${isDragging ? 'border-[#1d6b50] bg-[#e2eee8]/72 shadow-[0_22px_70px_rgba(22,54,42,0.09)]' : ''}`}
    >
      <Upload className="text-[#8da79a]" size={28} strokeWidth={1.5} aria-hidden="true" />
      <div className="mt-3 text-[16px] font-semibold tracking-[-0.05em] text-[#18211f]">
        動画をここにドロップ
      </div>
      <div className="mt-1 text-[11px] text-[#71807b]">または、追加方法を選択</div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          className="inline-flex items-center justify-center gap-1.5 rounded-[8px] border border-[#b7cbc0] bg-white px-3 py-2.5 text-[11px] font-semibold text-[#1d6b50] hover:bg-[#f4faf6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25"
          type="button"
          onClick={() => void onChoose()}
        >
          <FolderOpen size={14} /> Finderから選ぶ
        </button>
        {onYoutubeClick && (
          <button
            className="inline-flex items-center justify-center gap-1.5 rounded-[8px] border border-[#b7cbc0] bg-white px-3 py-2.5 text-[11px] font-semibold text-[#1d6b50] hover:bg-[#f4faf6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25"
            type="button"
            onClick={onYoutubeClick}
          >
            <Link size={14} /> YouTube URL
          </button>
        )}
      </div>
    </div>
  )
}
