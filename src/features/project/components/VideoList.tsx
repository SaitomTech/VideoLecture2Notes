import { ChevronRight, Trash2 } from 'lucide-react'
import type { RefObject } from 'react'
import { formatTimestamp } from '../../../lib/time'
import { formatSize } from '../../import/utils'
import type { YoutubeImportOptions, YoutubeImportRequest, SelectedVideo } from '../../import/types'
import type { MediaProject, ProjectVideo } from '../../../types/project'
import { VideoImportPanel, type VideoImportPanelHandle } from '../VideoImportPanel'
import { VideoThumbnail } from './VideoThumbnail'

export type VideoImportSource = 'finder' | 'youtube'

export function VideoList({
  project,
  videoImportContainerRef,
  videoImportPanelRef,
  onStartArticleCreator,
  onDeleteVideo,
  onAddLocalVideo,
  onAddYoutubeVideo,
  onVideoAdded,
  continueToPreparation,
}: {
  project: MediaProject
  videoImportContainerRef: RefObject<HTMLDivElement | null>
  videoImportPanelRef: RefObject<VideoImportPanelHandle | null>
  onStartArticleCreator: (video: ProjectVideo) => void
  onDeleteVideo: (videoId: string) => void
  onAddLocalVideo: (video: SelectedVideo) => Promise<ProjectVideo>
  onAddYoutubeVideo: (
    request: YoutubeImportRequest,
    options: YoutubeImportOptions,
  ) => Promise<ProjectVideo>
  onVideoAdded?: (video: ProjectVideo) => void
  continueToPreparation?: boolean
}) {
  return (
    <section className="mt-0">
      <div className="overflow-hidden">
        {project.videos.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm font-semibold">追加した動画がここに表示されます</p>
            <p className="mt-2 text-xs text-[#71807b]">
              動画を保存してから、記事にする区間を指定できます。
            </p>
          </div>
        ) : (
          project.videos.map((video) => (
            <article
              className="flex flex-wrap items-center gap-4 border-b border-[#d8e1dc] px-0 py-3"
              key={video.id}
            >
              <VideoThumbnail video={video} />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <h3 className="truncate text-sm font-semibold">{video.title}</h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${video.media.origin?.kind === 'youtube' ? 'bg-[#fff0e9] text-[#a4573e]' : 'bg-[#e8f2ec] text-[#1d6b50]'}`}
                  >
                    {video.media.origin?.kind === 'youtube' ? 'YouTube' : 'ローカル'}
                  </span>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] text-[#71807b]">
                  <span>{formatTimestamp(video.media.metadata.durationMs)}</span>
                  <span className="text-[#b7cbc0]">·</span>
                  <span>
                    {video.media.metadata.width} × {video.media.metadata.height}
                  </span>
                  <span className="text-[#b7cbc0]">·</span>
                  <span>{formatSize(video.media.sizeBytes)}</span>
                  {video.media.origin?.kind === 'youtube' && (
                    <>
                      <span className="text-[#b7cbc0]">·</span>
                      <a
                        className="text-[#71807b] underline decoration-[#b7cbc0] underline-offset-2 hover:text-[#1d6b50] hover:decoration-[#1d6b50]"
                        href={video.media.origin.canonicalUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        YouTubeで開く
                      </a>
                    </>
                  )}
                </p>
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-[8px] border border-[#b8d2c5] bg-white px-3 py-2.5 text-xs font-semibold text-[#1d6b50] hover:bg-[#f4faf6]"
                type="button"
                onClick={() => onStartArticleCreator(video)}
              >
                この動画から記事を作成
                <ChevronRight size={14} />
              </button>
              <button
                className="rounded-[8px] p-2 text-[#9aa6a1] hover:bg-[#f8ebe7] hover:text-[#b6533a]"
                type="button"
                title="動画を削除"
                aria-label={`${video.title}を削除`}
                onClick={() => onDeleteVideo(video.id)}
              >
                <Trash2 size={14} />
              </button>
            </article>
          ))
        )}
      </div>
      <div ref={videoImportContainerRef} className="mt-4 scroll-mt-6">
        <VideoImportPanel
          ref={videoImportPanelRef}
          onAddLocalVideo={onAddLocalVideo}
          onAddYoutubeVideo={onAddYoutubeVideo}
          onVideoAdded={onVideoAdded}
          continueToPreparation={continueToPreparation}
        />
      </div>
    </section>
  )
}
