import { formatDuration, formatSize } from '../utils'
import type { MetadataLoadStatus, SelectedVideo, VideoLoadStatus } from '../types'

type SelectedVideoSummaryProps = {
  video: SelectedVideo | null
  videoStatus: VideoLoadStatus
  metadataStatus: MetadataLoadStatus
}

export function SelectedVideoSummary({ video, videoStatus, metadataStatus }: SelectedVideoSummaryProps) {
  const hasError = videoStatus === 'error' || metadataStatus === 'error'
  const isReady = videoStatus === 'ready' && metadataStatus === 'ready'
  const statusLabel = isReady ? 'READY' : hasError ? 'ERROR' : 'CHECKING'
  const statusColor = isReady ? 'text-[#1d6b50]' : hasError ? 'text-[#b6533a]' : 'text-[#9a7a35]'

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
          <div className="mt-[7px] grid grid-cols-2 gap-x-5 gap-y-1.5 text-[10px] text-[#9aa6a1]">
            <span>サイズ</span>
            <strong className="text-right font-mono text-[10px] font-normal text-[#71807b]">{formatSize(video.sizeBytes)}</strong>
            <span>長さ</span>
            <strong className="text-right font-mono text-[10px] font-normal text-[#71807b]">{formatDuration(video.metadata?.durationMs)}</strong>
            <span>解像度</span>
            <strong className="text-right font-mono text-[10px] font-normal text-[#71807b]">
              {video.metadata ? `${video.metadata.width} × ${video.metadata.height}` : '解析中…'}
            </strong>
          </div>
        </>
      )}
    </div>
  )
}
