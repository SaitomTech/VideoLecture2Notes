import { ArrowLeft } from 'lucide-react'
import { useRef, useState } from 'react'
import { AppHeader } from '../../components/AppHeader'
import type { SelectedVideo, YoutubeImportOptions, YoutubeImportRequest } from '../import/types'
import type {
  Article,
  CropRegion,
  MediaProject,
  PerspectiveCrop,
  ProjectVideo,
  VideoTrimRange,
} from '../../types/project'
import type { VideoImportPanelHandle } from './VideoImportPanel'
import { ArticleList } from './components/ArticleList'
import { DeleteArticleDialog } from './components/DeleteArticleDialog'
import { DeleteProjectDialog } from './components/DeleteProjectDialog'
import { DeleteVideoDialog } from './components/DeleteVideoDialog'
import { ProjectHeader } from './components/ProjectHeader'
import { SelectArticleVideoDialog } from './components/SelectArticleVideoDialog'
import { VideoList, type VideoImportSource } from './components/VideoList'
import { CreateArticleDialog } from './article-creator/CreateArticleDialog'
import { useProjectTitleEditor } from './hooks/useProjectTitleEditor'

type Tab = 'articles' | 'videos'

export function ProjectDetailPage({
  project,
  tab,
  onTabChange,
  onBack,
  onDeleteProject,
  onRenameProject,
  onAddLocalVideo,
  onAddYoutubeVideo,
  onOpenArticle,
  onDeleteArticle,
  onDeleteVideo,
  onCreateArticles,
}: {
  project: MediaProject
  tab: Tab
  onTabChange: (tab: Tab) => void
  onBack: () => void
  onDeleteProject: () => Promise<void>
  onRenameProject: (title: string) => Promise<void>
  onAddLocalVideo: (video: SelectedVideo) => Promise<ProjectVideo>
  onAddYoutubeVideo: (
    request: YoutubeImportRequest,
    options: YoutubeImportOptions,
  ) => Promise<ProjectVideo>
  onOpenArticle: (articleId: string) => void
  onDeleteArticle: (articleId: string) => Promise<void>
  onDeleteVideo: (videoId: string) => Promise<void>
  onCreateArticles: (
    videoId: string,
    ranges: Array<{ title: string; range: VideoTrimRange }>,
    crop: CropRegion,
    perspectiveCrop?: PerspectiveCrop,
  ) => Promise<Article[]>
}) {
  const [createVideo, setCreateVideo] = useState<ProjectVideo | null>(null)
  const [showVideoPicker, setShowVideoPicker] = useState(false)
  const [prepareAfterImport, setPrepareAfterImport] = useState(false)
  const [deleteVideo, setDeleteVideo] = useState<ProjectVideo | null>(null)
  const [deleteArticle, setDeleteArticle] = useState<Article | null>(null)
  const [isDeleteProjectOpen, setIsDeleteProjectOpen] = useState(false)
  const [isDeletingProject, setIsDeletingProject] = useState(false)
  const [projectDeleteError, setProjectDeleteError] = useState<string | null>(null)
  const videoImportContainerRef = useRef<HTMLDivElement | null>(null)
  const videoImportPanelRef = useRef<VideoImportPanelHandle | null>(null)
  const titleEditor = useProjectTitleEditor({
    initialTitle: project.title,
    onSave: onRenameProject,
  })

  const openArticleCreator = () => setShowVideoPicker(true)
  const openVideoImportSource = (source: VideoImportSource) => {
    setPrepareAfterImport(true)
    const open = () => {
      videoImportContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (source === 'finder') void videoImportPanelRef.current?.openFinder()
      else videoImportPanelRef.current?.openYoutube()
    }
    if (tab === 'videos') open()
    else {
      onTabChange('videos')
      window.setTimeout(open, 0)
    }
  }
  const handleCreateArticles = async (
    videoId: string,
    ranges: Array<{ title: string; range: VideoTrimRange }>,
    crop: CropRegion,
    perspectiveCrop?: PerspectiveCrop,
  ) => {
    await onCreateArticles(videoId, ranges, crop, perspectiveCrop)
  }

  const deleteCurrentProject = async () => {
    setIsDeletingProject(true)
    setProjectDeleteError(null)
    try {
      await onDeleteProject()
    } catch (cause) {
      setProjectDeleteError(
        cause instanceof Error ? cause.message : 'プロジェクトを削除できませんでした。',
      )
      setIsDeletingProject(false)
    }
  }

  const requestDeleteArticle = (articleId: string) => {
    const article = project.articles.find((candidate) => candidate.id === articleId)
    if (article) setDeleteArticle(article)
  }
  const requestDeleteVideo = (videoId: string) => {
    const video = project.videos.find((candidate) => candidate.id === videoId)
    if (video) setDeleteVideo(video)
  }

  return (
    <main className="min-h-svh bg-[#f4f7f4] font-[Avenir_Next,Hiragino_Sans,Yu_Gothic,system-ui,sans-serif] text-[#18211f]">
      <AppHeader onHome={onBack} />
      <section className="mx-auto w-[calc(100%-48px)] max-w-[1040px] pb-16 pt-6 md:w-[calc(100%-11.6vw)] md:pt-8">
        <button
          className="mb-7 inline-flex items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-xs font-semibold text-[#71807b] hover:bg-[#e2eee8] hover:text-[#1d6b50]"
          type="button"
          onClick={onBack}
        >
          <ArrowLeft size={14} strokeWidth={1.8} aria-hidden="true" />
          プロジェクト一覧へ戻る
        </button>
        <div className="mt-2 overflow-hidden rounded-[16px] border border-[#b7cbc0] bg-[#fbfcfa] shadow-[0_18px_52px_rgba(22,54,42,0.05)]">
          <ProjectHeader
            project={project}
            isEditingTitle={titleEditor.isEditing}
            titleDraft={titleEditor.draft}
            isSavingTitle={titleEditor.isSaving}
            titleError={titleEditor.error}
            onTitleDraftChange={titleEditor.setDraft}
            onStartTitleEditing={titleEditor.startEditing}
            onTitleKeyDown={titleEditor.handleKeyDown}
            onTitleBlur={titleEditor.handleBlur}
            onTitleCompositionStart={titleEditor.handleCompositionStart}
            onTitleCompositionEnd={titleEditor.handleCompositionEnd}
            onOpenArticleCreator={openArticleCreator}
            onRequestDelete={() => {
              setProjectDeleteError(null)
              setIsDeleteProjectOpen(true)
            }}
          />
          <div className="px-6 pb-8 sm:px-8 sm:pb-10">
            <div className="mt-6 flex gap-8 border-b border-[#b7cbc0]" role="tablist">
              <button
                className={`border-b-2 px-1 pb-1 text-sm font-semibold ${tab === 'articles' ? 'border-[#1d6b50] text-[#1d6b50]' : 'border-transparent text-[#9aa6a1]'}`}
                type="button"
                role="tab"
                aria-selected={tab === 'articles'}
                onClick={() => onTabChange('articles')}
              >
                記事{' '}
                <span className="relative -top-0.5 inline-flex min-w-[24px] items-center justify-center rounded-full bg-[#e8f2ec] px-1.5 py-0.5 align-middle font-mono text-[11px] text-[#71807b]">
                  {project.articles.length}
                </span>
              </button>
              <button
                className={`border-b-2 px-1 pb-1 text-sm font-semibold ${tab === 'videos' ? 'border-[#1d6b50] text-[#1d6b50]' : 'border-transparent text-[#9aa6a1]'}`}
                type="button"
                role="tab"
                aria-selected={tab === 'videos'}
                onClick={() => {
                  setPrepareAfterImport(false)
                  onTabChange('videos')
                }}
              >
                動画{' '}
                <span className="relative -top-0.5 inline-flex min-w-[24px] items-center justify-center rounded-full bg-[#e8f2ec] px-1.5 py-0.5 align-middle font-mono text-[11px] text-[#71807b]">
                  {project.videos.length}
                </span>
              </button>
            </div>
            {tab === 'articles' ? (
              <ArticleList
                project={project}
                onStartArticleCreator={openArticleCreator}
                onOpenArticle={onOpenArticle}
                onDeleteArticle={requestDeleteArticle}
              />
            ) : (
              <VideoList
                project={project}
                videoImportContainerRef={videoImportContainerRef}
                videoImportPanelRef={videoImportPanelRef}
                onStartArticleCreator={setCreateVideo}
                onVideoAdded={(video) => {
                  if (!prepareAfterImport) return
                  setPrepareAfterImport(false)
                  setCreateVideo(video)
                }}
                continueToPreparation={prepareAfterImport}
                onDeleteVideo={requestDeleteVideo}
                onAddLocalVideo={onAddLocalVideo}
                onAddYoutubeVideo={onAddYoutubeVideo}
              />
            )}
          </div>
        </div>
        {showVideoPicker && (
          <SelectArticleVideoDialog
            project={project}
            onClose={() => {
              setPrepareAfterImport(false)
              setShowVideoPicker(false)
            }}
            onSelect={(video) => {
              setShowVideoPicker(false)
              setCreateVideo(video)
            }}
            onOpenVideos={(source) => {
              setShowVideoPicker(false)
              openVideoImportSource(source)
            }}
          />
        )}
        {createVideo && (
          <CreateArticleDialog
            projectId={project.id}
            video={createVideo}
            onClose={() => setCreateVideo(null)}
            onSubmit={(ranges, crop, perspectiveCrop) =>
              handleCreateArticles(createVideo.id, ranges, crop, perspectiveCrop)
            }
          />
        )}
        {deleteVideo && (
          <DeleteVideoDialog
            video={deleteVideo}
            onClose={() => setDeleteVideo(null)}
            onConfirm={() => onDeleteVideo(deleteVideo.id)}
          />
        )}
        {deleteArticle && (
          <DeleteArticleDialog
            article={deleteArticle}
            onClose={() => setDeleteArticle(null)}
            onConfirm={() => onDeleteArticle(deleteArticle.id)}
          />
        )}
        <DeleteProjectDialog
          open={isDeleteProjectOpen}
          title={project.title}
          busy={isDeletingProject}
          error={projectDeleteError}
          onClose={() => setIsDeleteProjectOpen(false)}
          onConfirm={() => void deleteCurrentProject()}
        />
      </section>
    </main>
  )
}
