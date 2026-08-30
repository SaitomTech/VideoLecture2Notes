import { formatSize } from '../utils'
import type { SelectedVideo, VideoLoadStatus } from '../types'

type SelectedVideoSummaryProps = {
  video: SelectedVideo | null
  videoStatus: VideoLoadStatus
}

export function SelectedVideoSummary({ video, videoStatus }: SelectedVideoSummaryProps) {
  const statusLabel = videoStatus === 'ready' ? 'READY' : videoStatus === 'error' ? 'ERROR' : 'CHECKING'
  const statusColor = videoStatus === 'ready' ? 'text-[#1d6b50]' : videoStatus === 'error' ? 'text-[#b6533a]' : 'text-[#9a7a35]'

  return (
    <div
      className={`min-h-24 pointer-events-none mt-[22px] border-y border-[#d8e1dc] px-5 py-[17px] transition-[opacity,transform] duration-200 ${video ? 'translate-y-0 opacity-100' : 'translate-y-[5px] opacity-0'}`}
      aria-live="polite"
    >
      {video && (
        <>
          <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.08em] text-[#71807b]">
            <span>選択した動画</span>
            <span className={statusColor}>{statusLabel}</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2.5">
            <div className="max-w-[76%] truncate text-[13px] font-semibold text-[#18211f]" title={video.path}>
              {video.name}
            </div>
            <span className="font-mono text-[10px] text-[#1d6b50]">.{video.extension}</span>
          </div>
          <div className="mt-[7px] flex items-center justify-between text-[10px] text-[#9aa6a1]">
            <span>サイズ</span>
            <strong className="font-mono text-[10px] font-normal text-[#71807b]">{formatSize(video.sizeBytes)}</strong>
          </div>
        </>
      )}
    </div>
  )
}
