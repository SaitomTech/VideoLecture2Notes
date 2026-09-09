import { VideoDropZone } from './VideoDropZone'
import { useVideoPicker } from '../hooks/useVideoPicker'
import { SelectedVideoSummary } from './SelectedVideoSummary'

type LocalVideoImportPanelProps = {
  picker: ReturnType<typeof useVideoPicker>
  disabled: boolean
}

export function LocalVideoImportPanel({ picker, disabled }: LocalVideoImportPanelProps) {
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
        />
      ) : (
        <VideoDropZone
          isDragging={picker.isDragging}
          disabled={disabled}
          onChoose={picker.chooseVideo}
        />
      )}

      {loadError && <p className="mt-3 px-1 text-xs text-[#b6533a]">{loadError}</p>}
    </div>
  )
}
