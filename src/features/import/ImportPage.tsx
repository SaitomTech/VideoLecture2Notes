import { AppHeader } from '../../components/AppHeader'
import { WorkflowBar } from '../../components/WorkflowBar'
import { SelectedVideoSummary } from './components/SelectedVideoSummary'
import { VideoDropZone } from './components/VideoDropZone'
import { VideoPreview } from './components/VideoPreview'
import { useVideoPicker } from './hooks/useVideoPicker'

export function ImportPage() {
  const picker = useVideoPicker()

  return (
    <main className="flex min-h-svh flex-col bg-[#f4f7f4] font-[Avenir_Next,Hiragino_Sans,Yu_Gothic,system-ui,sans-serif] text-[18px] leading-[1.45] tracking-[0.18px] text-[#18211f]">
      <AppHeader />
      <WorkflowBar />

      <section className="mx-auto flex min-h-[540px] w-[calc(100%-48px)] max-w-[1040px] flex-1 items-start justify-center pt-10 md:w-[calc(100%-11.6vw)] md:pt-14">
        <div className="w-full max-w-[720px]">
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
              <SelectedVideoSummary video={picker.selectedVideo} videoStatus={picker.videoStatus} />
            </>
          )}

          {!picker.selectedVideo && <VideoDropZone isDragging={picker.isDragging} onChoose={picker.chooseVideo} />}

          {picker.error && <p className="mt-3 px-1 text-xs text-[#b6533a]">{picker.error}</p>}

          <div className="mt-6 flex justify-end gap-5">
            <button
              className="inline-flex items-center gap-[18px] rounded-[9px] bg-[#1d6b50] px-5 py-3.5 text-xs font-semibold text-[#f3faf6] shadow-[0_7px_16px_rgba(29,107,80,0.17)] transition hover:-translate-y-0.5 hover:bg-[#174d3c] hover:shadow-[0_9px_20px_rgba(29,107,80,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none"
              type="button"
              disabled={!picker.selectedVideo || picker.isSelecting || picker.videoStatus !== 'ready'}
            >
              <span>スライド領域を設定</span>
              <span className="text-[17px] font-normal leading-none" aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
