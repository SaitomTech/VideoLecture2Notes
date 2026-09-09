import { VideoDropZone } from './VideoDropZone'
import { useVideoPicker } from '../hooks/useVideoPicker'
import { SelectedVideoSummary } from './SelectedVideoSummary'

type LocalVideoImportPanelProps = {
  picker: ReturnType<typeof useVideoPicker>
  disabled: boolean
  onYoutubeDownload: () => void
}

export function LocalVideoImportPanel({
  picker,
  disabled,
  onYoutubeDownload,
}: LocalVideoImportPanelProps) {
  const loadError = picker.selectedVideo
    ? picker.metadataError
    : picker.error || picker.metadataError

  return (
    <div>
      {picker.selectedVideo ? (
        <SelectedVideoSummary
          video={picker.selectedVideo}
          disabled={disabled}
          isSelecting={picker.isSelecting}
          onChoose={picker.chooseVideo}
          onYoutubeDownload={onYoutubeDownload}
        />
      ) : (
        <VideoDropZone
          isDragging={picker.isDragging}
          disabled={disabled}
          onChoose={picker.chooseVideo}
          onYoutubeDownload={onYoutubeDownload}
        />
      )}

      {loadError && <p className="mt-3 px-1 text-xs text-[#b6533a]">{loadError}</p>}
    </div>
  )
}
