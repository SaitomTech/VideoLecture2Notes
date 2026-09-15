import { useRef, useState } from 'react'
import { ArticleReviewPage } from '../features/article/ArticleReviewPage'
import { ExportPage } from '../features/export/ExportPage'
import { GenerateNotesPage } from '../features/generate-notes/GenerateNotesPage'
import { HomePage } from '../features/home/HomePage'
import { ProjectDetailPage } from '../features/project/ProjectDetailPage'
import { SlideDetectionPage } from '../features/slide-detection/SlideDetectionPage'
import { canNavigateToWorkflowStep, type WorkflowStep } from '../lib/workflow'
import {
  activateArticle,
  createEmptyProject,
  markProjectOpened,
  markProjectExported,
  updateProjectArticleDraft,
  updateProjectArticleSummary,
  updateProjectSlideContent,
  updateProjectSlideDetection,
  updateProjectSlideOcr,
  updateProjectSlideResultEdits,
  updateProjectTranscription,
  updateProjectWorkflow,
} from '../lib/project/project'
import { addProjectVideo, createArticlesFromRanges } from '../lib/project/projectMedia'
import {
  deleteProject,
  deleteProjectArticle,
  deleteProjectVideo,
  loadProject,
  saveProject,
  saveProjectWithCreatedAssets,
} from '../lib/storage/projectStorage'
import { removeProjectSourceAssetDirectory } from '../lib/storage/projectAssets'
import { downloadYoutubeVideo } from '../lib/youtube/downloader'
import type { SelectedVideo } from '../features/import/types'
import type { YoutubeImportOptions, YoutubeImportRequest } from '../features/import/types'
import type { YoutubeDownloadInput } from '../lib/youtube/types'
import type {
  ArticleDraft,
  ArticleSummary,
  ContentProcessingResult,
  CropRegion,
  MediaProject,
  PerspectiveCrop,
  ProjectStep,
  ProjectVideo,
  SlideOcrResult,
  SlideResultEdits,
  TranscriptionResult,
  VideoTrimRange,
} from '../types/project'
import type { SlideDetectionOutput } from '../features/slide-detection/types'

type Route =
  | { kind: 'home' }
  | { kind: 'project'; tab: 'articles' | 'videos' }
  | { kind: 'article'; articleId: string; step: ProjectStep }

function App() {
  const [route, setRoute] = useState<Route>({ kind: 'home' })
  const [project, setProject] = useState<MediaProject | null>(null)
  const projectRef = useRef<MediaProject | null>(null)
  const projectOperationQueue = useRef<Promise<unknown> | null>(null)
  const navigationRequestRef = useRef(0)

  const enqueueProjectOperation = <T,>(operation: () => Promise<T>) => {
    const previous = projectOperationQueue.current ?? Promise.resolve()
    const next = previous.then(operation, operation)
    projectOperationQueue.current = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }

  const saveProjectState = async (nextProject: MediaProject) => {
    const synced = await saveProject(nextProject)
    projectRef.current = synced
    setProject(synced)
    return synced
  }

  const persistProject = (nextProject: MediaProject) =>
    enqueueProjectOperation(() => saveProjectState(nextProject))

  const updateCurrentProject = (update: (current: MediaProject) => MediaProject) =>
    enqueueProjectOperation(async () => {
      const current = projectRef.current
      if (!current) return null
      return saveProjectState(update(current))
    })

  const handleCreateProject = async (title: string) => {
    const next = createEmptyProject(title)
    await persistProject(next)
    setRoute({ kind: 'project', tab: 'articles' })
  }

  const handleRenameProject = async (title: string) => {
    const trimmed = title.trim()
    if (!trimmed) throw new Error('プロジェクト名を入力してください。')
    const saved = await updateCurrentProject((current) => ({
      ...current,
      title: trimmed,
      updatedAt: new Date().toISOString(),
    }))
    if (!saved) throw new Error('プロジェクトが選択されていません。')
  }

  const handleOpenProject = async (projectId: string) => {
    const requestId = ++navigationRequestRef.current
    await enqueueProjectOperation(async () => {
      const loaded = await loadProject(projectId)
      const next = markProjectOpened(
        loaded,
        loaded.activeArticleId ? loaded.workflow.lastVisitedStep : 'detect-slides',
      )
      await saveProjectState(next)
      if (requestId === navigationRequestRef.current) setRoute({ kind: 'project', tab: 'articles' })
    })
  }

  const handleDeleteProject = async (projectId: string) => {
    await enqueueProjectOperation(async () => {
      await deleteProject(projectId)
      if (projectRef.current?.id === projectId) {
        projectRef.current = null
        setProject(null)
        setRoute({ kind: 'home' })
      }
    })
  }

  const handleAddLocalVideo = async (video: SelectedVideo): Promise<ProjectVideo> => {
    return enqueueProjectOperation(async () => {
      const current = projectRef.current
      if (!current) throw new Error('プロジェクトが選択されていません。')
      const added = await addProjectVideo(current, video)
      const saved = await saveProjectWithCreatedAssets(added.project, [
        { collection: 'videos', assetId: added.video.id },
      ])
      projectRef.current = saved
      setProject(saved)
      return added.video
    })
  }

  const handleAddYoutubeVideo = async (
    request: YoutubeImportRequest,
    options: YoutubeImportOptions,
  ): Promise<ProjectVideo> => {
    const temporaryProjectId = crypto.randomUUID()
    return enqueueProjectOperation(async () => {
      try {
        const video = await downloadYoutubeVideo({
          projectId: temporaryProjectId,
          info: request.info,
          quality: request.quality,
          signal: options.signal,
          onProgress: options.onProgress,
        } satisfies YoutubeDownloadInput)
        const current = projectRef.current
        if (!current) throw new Error('プロジェクトが選択されていません。')
        const added = await addProjectVideo(current, video)
        const saved = await saveProjectWithCreatedAssets(added.project, [
          { collection: 'videos', assetId: added.video.id },
        ])
        projectRef.current = saved
        setProject(saved)
        return added.video
      } finally {
        await removeProjectSourceAssetDirectory(temporaryProjectId).catch(() => undefined)
      }
    })
  }

  const handleCreateArticles = async (
    videoId: string,
    ranges: Array<{
      title: string
      range: VideoTrimRange
    }>,
    crop: CropRegion,
    perspectiveCrop?: PerspectiveCrop,
  ) => {
    return enqueueProjectOperation(async () => {
      const current = projectRef.current
      if (!current) throw new Error('プロジェクトが選択されていません。')
      const created = await createArticlesFromRanges(
        current,
        videoId,
        ranges,
        crop,
        perspectiveCrop,
      )
      const nextProject = {
        ...current,
        articles: [...current.articles, ...created],
        updatedAt: new Date().toISOString(),
      }
      const firstArticle = created[0]
      if (!firstArticle) throw new Error('記事を作成できませんでした。')
      const activated = markProjectOpened(
        activateArticle(nextProject, firstArticle.id),
        firstArticle.workflow.lastVisitedStep,
      )
      const saved = await saveProjectWithCreatedAssets(
        activated,
        created.map((article) => ({ collection: 'articles' as const, assetId: article.id })),
      )
      projectRef.current = saved
      setProject(saved)
      setRoute({
        kind: 'article',
        articleId: firstArticle.id,
        step: firstArticle.workflow.lastVisitedStep,
      })
      return created
    })
  }

  const handleOpenArticle = async (articleId: string) => {
    const requestId = ++navigationRequestRef.current
    await enqueueProjectOperation(async () => {
      const current = projectRef.current
      if (!current) return
      const next = activateArticle(current, articleId)
      const article = next.articles.find((candidate) => candidate.id === articleId)
      const opened = markProjectOpened(next, article?.workflow.lastVisitedStep ?? 'detect-slides')
      await saveProjectState(opened)
      if (requestId === navigationRequestRef.current)
        setRoute({
          kind: 'article',
          articleId,
          step: article?.workflow.lastVisitedStep ?? 'detect-slides',
        })
    })
  }

  const handleDeleteArticle = async (articleId: string) => {
    await enqueueProjectOperation(async () => {
      const current = projectRef.current
      if (!current) return
      const saved = await deleteProjectArticle(current, articleId)
      projectRef.current = saved
      setProject(saved)
    })
  }

  const handleDeleteVideo = async (videoId: string) => {
    await enqueueProjectOperation(async () => {
      const current = projectRef.current
      if (!current) return
      const saved = await deleteProjectVideo(current, videoId)
      projectRef.current = saved
      setProject(saved)
    })
  }

  const handleBackToProject = () => {
    navigationRequestRef.current += 1
    setRoute({ kind: 'project', tab: 'articles' })
  }

  const handleWorkflowStep = async (nextStep: WorkflowStep) => {
    try {
      if (route.kind !== 'article' || !projectRef.current) return
      if (nextStep === 'import') return
      if (!canNavigateToWorkflowStep(projectRef.current.workflow.maxReachedStep, nextStep)) return
      const requestId = ++navigationRequestRef.current
      const articleId = route.articleId
      const saved = await updateCurrentProject((current) => markProjectOpened(current, nextStep))
      if (!saved || requestId !== navigationRequestRef.current) return
      setRoute({ kind: 'article', articleId, step: nextStep })
    } catch (error) {
      console.error('ステップを移動できませんでした。', error)
    }
  }

  const handleProjectStep = async (nextStep: ProjectStep) => {
    try {
      if (route.kind !== 'article') return
      const requestId = ++navigationRequestRef.current
      const articleId = route.articleId
      if (nextStep === 'export') {
        const saved = await updateCurrentProject((current) => markProjectOpened(current, nextStep))
        if (saved && requestId === navigationRequestRef.current)
          setRoute({ kind: 'article', articleId, step: nextStep })
        return
      }
      const saved = await updateCurrentProject((current) =>
        updateProjectWorkflow(current, nextStep),
      )
      if (saved && requestId === navigationRequestRef.current)
        setRoute({ kind: 'article', articleId, step: nextStep })
    } catch (error) {
      console.error('次のステップへ移動できませんでした。', error)
    }
  }

  const handleExportCompleted = async () => {
    await updateCurrentProject(markProjectExported)
  }

  const handleSlideDetectionCompleted = async (output: SlideDetectionOutput) => {
    await updateCurrentProject((current) =>
      updateProjectSlideDetection(current, output.result, output.slides),
    )
  }
  const handleTranscriptionCompleted = async (transcription: TranscriptionResult) => {
    await updateCurrentProject((current) => updateProjectTranscription(current, transcription))
  }
  const handleOcrSlideCompleted = async (slideId: string, ocr: SlideOcrResult) => {
    await updateCurrentProject((current) => updateProjectSlideOcr(current, slideId, ocr))
  }
  const handleContentSlideCompleted = async (slideId: string, result: ContentProcessingResult) => {
    await updateCurrentProject((current) => updateProjectSlideContent(current, slideId, result))
  }
  const handleSaveSlideResultEdits = async (slideId: string, edits: SlideResultEdits) => {
    await updateCurrentProject((current) => updateProjectSlideResultEdits(current, slideId, edits))
  }
  const handleSaveArticle = async (draft: ArticleDraft) => {
    await updateCurrentProject((current) => updateProjectArticleDraft(current, draft))
  }
  const handleSaveArticleSummary = async (summary: ArticleSummary) => {
    await updateCurrentProject((current) => updateProjectArticleSummary(current, summary))
  }

  if (route.kind === 'home')
    return <HomePage onCreateProject={handleCreateProject} onOpenProject={handleOpenProject} />
  if (!project) return null
  if (route.kind === 'project')
    return (
      <ProjectDetailPage
        project={project}
        tab={route.tab}
        onTabChange={(tab) => setRoute({ kind: 'project', tab })}
        onBack={() => setRoute({ kind: 'home' })}
        onDeleteProject={() => handleDeleteProject(project.id)}
        onRenameProject={handleRenameProject}
        onAddLocalVideo={handleAddLocalVideo}
        onAddYoutubeVideo={handleAddYoutubeVideo}
        onOpenArticle={(articleId) => void handleOpenArticle(articleId)}
        onDeleteArticle={handleDeleteArticle}
        onDeleteVideo={handleDeleteVideo}
        onCreateArticles={handleCreateArticles}
      />
    )
  const articleProps = {
    maxReachedStep: project.workflow.maxReachedStep,
    onStepClick: handleWorkflowStep,
  }
  if (route.step === 'detect-slides')
    return (
      <SlideDetectionPage
        key={route.articleId}
        project={project}
        onCompleted={handleSlideDetectionCompleted}
        onContinue={() => void handleProjectStep('generate-notes')}
        onHome={handleBackToProject}
        onOpenArticle={handleOpenArticle}
        {...articleProps}
      />
    )
  if (route.step === 'generate-notes')
    return (
      <GenerateNotesPage
        key={route.articleId}
        project={project}
        onCompleted={handleTranscriptionCompleted}
        onOcrSlideCompleted={handleOcrSlideCompleted}
        onContentSlideCompleted={handleContentSlideCompleted}
        getCurrentProject={() => projectRef.current}
        onSaveSlideResultEdits={handleSaveSlideResultEdits}
        onOpenArticleReview={() => void handleProjectStep('article-review')}
        onHome={handleBackToProject}
        onOpenArticle={handleOpenArticle}
        {...articleProps}
      />
    )
  if (route.step === 'article-review')
    return (
      <ArticleReviewPage
        key={route.articleId}
        project={project}
        onSave={handleSaveArticle}
        onSaveSummary={handleSaveArticleSummary}
        onExport={() => void handleProjectStep('export')}
        onHome={handleBackToProject}
        onOpenArticle={handleOpenArticle}
        {...articleProps}
      />
    )
  return (
    <ExportPage
      key={route.articleId}
      project={project}
      onHome={handleBackToProject}
      onOpenArticle={handleOpenArticle}
      onGenerated={handleExportCompleted}
      {...articleProps}
    />
  )
}

export default App
