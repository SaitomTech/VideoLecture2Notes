import { SelectedVideoSummary } from './SelectedVideoSummary'
import { VideoDropZone } from './VideoDropZone'
import { VideoPreview } from './VideoPreview'
import { useVideoPicker } from '../hooks/useVideoPicker'

type LocalVideoImportPanelProps = {
  picker: ReturnType<typeof useVideoPicker>
  isContinuing: boolean
  continueError: string | null
  onContinue: () => void | Promise<void>
}

export function LocalVideoImportPanel({
  picker,
  isContinuing,
  continueError,
  onContinue,
}: LocalVideoImportPanelProps) {
  return (
    <>
      {picker.selectedVideo && (
        <>
          <VideoPreview
            video={picker.selectedVideo}
            videoStatus={picker.videoStatus}
            isDragging={picker.isDragging}
            isSelecting={picker.isSelecting}
            onChoose={picker.chooseVideo}
            onVideoReady={picker.handleVideoReady}
            onVideoError={picker.handleVideoError}
          />
          <SelectedVideoSummary
            video={picker.selectedVideo}
            videoStatus={picker.videoStatus}
            metadataStatus={picker.metadataStatus}
          />
        </>
      )}

      {!picker.selectedVideo && (
        <VideoDropZone isDragging={picker.isDragging} onChoose={picker.chooseVideo} />
      )}

      {(picker.error || picker.metadataError || continueError) && (
        <p className="mt-3 px-1 text-xs text-[#b6533a]">
          {picker.error || picker.metadataError || continueError}
        </p>
      )}

      <div className="mt-6 flex justify-end gap-5">
        <button
          className="inline-flex items-center gap-[18px] rounded-[9px] bg-[#1d6b50] px-5 py-3.5 text-xs font-semibold text-[#f3faf6] shadow-[0_7px_16px_rgba(29,107,80,0.17)] transition hover:-translate-y-0.5 hover:bg-[#174d3c] hover:shadow-[0_9px_20px_rgba(29,107,80,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none"
          type="button"
          onClick={() => void onContinue()}
          disabled={
            !picker.selectedVideo ||
            picker.isSelecting ||
            isContinuing ||
            picker.videoStatus !== 'ready' ||
            picker.metadataStatus !== 'ready'
          }
        >
          <span>{isContinuing ? '準備中…' : 'スライド領域を設定'}</span>
          <span className="text-[17px] font-normal leading-none" aria-hidden="true">
            →
          </span>
        </button>
      </div>
    </>
  )
}
