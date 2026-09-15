import { ChevronRight, FileVideo, X } from 'lucide-react'
import { useDialogA11y } from '../../../lib/ui/useDialogA11y'
import { formatTimestamp } from '../../../lib/time'
import type { MediaProject, ProjectVideo } from '../../../types/project'
import { VideoThumbnail } from './VideoThumbnail'
export function SelectArticleVideoDialog({
  project,
  onClose,
  onSelect,
  onOpenVideos,
}: {
  project: MediaProject
  onClose: () => void
  onSelect: (video: ProjectVideo) => void
  onOpenVideos: () => void
}) {
  const dialogRef = useDialogA11y({ open: true, onClose })
  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-0 grid h-full w-full max-w-none place-items-center border-0 bg-[#18211f]/35 px-5 py-6 backdrop-blur-[2px]"
      open
      aria-modal="true"
      aria-labelledby="select-article-video-title"
    >
      <section className="max-h-[88vh] w-full max-w-[680px] overflow-auto rounded-[16px] border border-[#b7cbc0] bg-[#fbfcfa] p-6 shadow-[0_24px_70px_rgba(24,33,31,0.2)] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#71807b]">
              Create article
            </p>
            <h2
              id="select-article-video-title"
              className="mt-1 text-[22px] font-bold tracking-[-0.04em]"
            >
              元動画を選ぶ
            </h2>
            <p className="mt-1 text-xs text-[#71807b]">
              記事にする区間を指定する元動画を選択してください。
            </p>
          </div>
          <button
            className="rounded-md p-1.5 text-[#71807b] hover:bg-[#e8f2ec]"
            type="button"
            onClick={onClose}
            aria-label="元動画の選択を閉じる"
          >
            <X size={18} />
          </button>
        </div>

        {project.videos.length === 0 ? (
          <div className="mt-6 rounded-[10px] border border-dashed border-[#b7cbc0] bg-white px-6 py-12 text-center">
            <FileVideo className="mx-auto text-[#8da79a]" size={28} strokeWidth={1.5} />
            <p className="mt-3 text-sm font-semibold">元動画がありません</p>
            <p className="mt-2 text-xs text-[#71807b]">
              先に動画を追加すると、そこから記事にする区間を指定できます。
            </p>
            <button
              className="mt-5 inline-flex items-center gap-1.5 rounded-[8px] bg-[#1d6b50] px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-[#174d3c]"
              type="button"
              onClick={onOpenVideos}
            >
              動画を追加
              <ChevronRight size={14} />
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-2">
            {project.videos.map((video) => {
              const articleCount = project.articles.filter(
                (article) => article.sourceVideoId === video.id,
              ).length
              const isYoutube = video.media.origin?.kind === 'youtube'
              return (
                <button
                  className="flex w-full items-center gap-3 rounded-[10px] border border-[#d8e1dc] bg-white p-3 text-left transition hover:border-[#9fc3b0] hover:bg-[#f8fbf9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25"
                  key={video.id}
                  type="button"
                  onClick={() => onSelect(video)}
                >
                  <VideoThumbnail video={video} />
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-semibold">{video.title}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isYoutube ? 'bg-[#fff0e9] text-[#a4573e]' : 'bg-[#e8f2ec] text-[#1d6b50]'}`}
                      >
                        {isYoutube ? 'YouTube' : 'ローカル'}
                      </span>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] text-[#71807b]">
                      <span>{formatTimestamp(video.media.metadata.durationMs)}</span>
                      <span className="text-[#b7cbc0]">·</span>
                      <span>{articleCount}件の記事</span>
                    </span>
                  </span>
                  <ChevronRight className="shrink-0 text-[#8da79a]" size={16} />
                </button>
              )
            })}
          </div>
        )}

        <div className="mt-6 flex justify-end border-t border-[#d8e1dc] pt-4">
          <button
            className="rounded-[8px] px-3 py-2.5 text-xs font-semibold text-[#71807b] hover:bg-[#eef3ef]"
            type="button"
            onClick={onClose}
          >
            キャンセル
          </button>
        </div>
      </section>
    </dialog>
  )
}
