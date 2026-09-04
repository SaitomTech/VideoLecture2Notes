import { useRef, useState } from 'react'
import { ArticleReviewPage } from '../features/article/ArticleReviewPage'
import { CropPage } from '../features/crop/CropPage'
import { ExportPage } from '../features/export/ExportPage'
import { GenerateNotesPage } from '../features/generate-notes/GenerateNotesPage'
import { ImportPage } from '../features/import/ImportPage'
import { HomePage } from '../features/home/HomePage'
import { SlideDetectionPage } from '../features/slide-detection/SlideDetectionPage'
import {
  createMediaProject,
  markProjectOpened,
  updateProjectSource,
  updateProjectWorkflow,
  updateProjectArticleDraft,
  updateProjectArticleSummary,
  updateProjectCrop,
  updateProjectSlideContent,
  updateProjectSlideDetection,
  updateProjectSlideOcr,
  updateProjectSlideResultEdits,
  updateProjectTranscriptAlignment,
  updateProjectTranscriptPlacement,
  updateProjectTranscription,
} from '../lib/project/project'
import {
  loadProject,
  loadProjectForResume,
  saveProject,
  deleteProject,
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
  MediaSource,
  ProjectStep,
  SlideOcrResult,
  SlideResultEdits,
  TranscriptAlignment,
  TranscriptionResult,
} from '../types/project'
import type { SlideDetectionOutput } from '../features/slide-detection/types'

type AppStep = 'home' | 'import' | ProjectStep

async function relinkProject(projectId: string, source: MediaSource) {
  const project = await loadProject(projectId)
  const metadataMatches =
    project.source.metadata.width === source.metadata.width &&
    project.source.metadata.height === source.metadata.height &&
    Math.abs(project.source.metadata.durationMs - source.metadata.durationMs) <= 2_000
  const sizeMatches =
    project.source.sizeBytes === undefined ||
    source.sizeBytes === undefined ||
    project.source.sizeBytes === source.sizeBytes

  if (!metadataMatches || !sizeMatches) {
    throw new Error('選択した動画は、保存時の元動画と一致しません。別の動画を選択してください。')
  }

  await saveProject(
    updateProjectSource(project, {
      ...source,
      origin: source.origin ?? { kind: 'local-file' },
    }),
  )
}

async function removeProject(projectId: string) {
  await deleteProject(projectId)
}

function App() {
  const [step, setStep] = useState<AppStep>('home')
  const [project, setProject] = useState<MediaProject | null>(null)
  const projectRef = useRef<MediaProject | null>(null)

  const persistProject = async (nextProject: MediaProject) => {
    await saveProject(nextProject)
    projectRef.current = nextProject
    setProject(nextProject)
  }

  const updateCurrentProject = async (update: (currentProject: MediaProject) => MediaProject) => {
    const currentProject = projectRef.current
    if (!currentProject) return null

    const nextProject = update(currentProject)
    await persistProject(nextProject)
    return nextProject
  }

  const handleImportContinue = async (video: SelectedVideo) => {
    if (!video.metadata) throw new Error('動画メタデータがありません')

    await persistProject(createMediaProject(video, video.metadata))
    setStep('crop')
  }

  const handleYoutubeImport = async (
    request: YoutubeImportRequest,
    options: YoutubeImportOptions,
  ) => {
    const projectId = crypto.randomUUID()

    try {
      const video = await downloadYoutubeVideo({
        projectId,
        info: request.info,
        quality: request.quality,
        signal: options.signal,
        onProgress: options.onProgress,
      } satisfies YoutubeDownloadInput)
      if (!video.metadata) throw new Error('取得した動画のメタデータがありません')

      await persistProject(createMediaProject(video, video.metadata, projectId))
      setStep('crop')
    } catch (error) {
      await removeProjectSourceAssetDirectory(projectId).catch(() => undefined)
      throw error
    }
  }

  const handleCreateProject = () => {
    projectRef.current = null
    setProject(null)
    setStep('import')
  }

  const handleGoHome = () => {
    setStep('home')
  }

  const handleProjectStep = async (nextStep: ProjectStep) => {
    const currentProject = projectRef.current
    if (!currentProject) return

    await persistProject(updateProjectWorkflow(currentProject, nextStep))
    setStep(nextStep)
  }

  const handleOpenProject = async (projectId: string) => {
    const result = await loadProjectForResume(projectId)
    if (result.kind === 'source-missing') {
      throw new Error(
        '元動画にアクセスできません。保存済みプロジェクトから動画を再指定してください。',
      )
    }
    if (result.kind === 'invalid') throw new Error(result.message)

    const nextProject = markProjectOpened(result.project, result.step)
    await persistProject(nextProject)
    setStep(result.step)
  }

  const handleApplyCrop = async (crop: CropRegion) => {
    const nextProject = await updateCurrentProject((currentProject) =>
      updateProjectCrop(currentProject, crop),
    )
    if (!nextProject) return
    setStep('detect-slides')
  }

  const handleSlideDetectionCompleted = async (output: SlideDetectionOutput) => {
    await updateCurrentProject((currentProject) =>
      updateProjectSlideDetection(currentProject, output.result, output.slides),
    )
  }

  const handleTranscriptionCompleted = async (transcription: TranscriptionResult) => {
    await updateCurrentProject((currentProject) =>
      updateProjectTranscription(currentProject, transcription),
    )
  }

  const handleOcrSlideCompleted = async (slideId: string, ocr: SlideOcrResult) => {
    await updateCurrentProject((currentProject) =>
      updateProjectSlideOcr(currentProject, slideId, ocr),
    )
  }

  const handleContentSlideCompleted = async (slideId: string, result: ContentProcessingResult) => {
    await updateCurrentProject((currentProject) =>
      updateProjectSlideContent(currentProject, slideId, result),
    )
  }

  const handleTranscriptAlignmentCompleted = async (alignment: TranscriptAlignment) => {
    await updateCurrentProject((currentProject) =>
      updateProjectTranscriptAlignment(currentProject, alignment),
    )
  }

  const handleTranscriptPlacementChange = async (unitId: string, slideId: string) => {
    await updateCurrentProject((currentProject) =>
      updateProjectTranscriptPlacement(currentProject, unitId, slideId),
    )
  }

  const handleSaveSlideResultEdits = async (slideId: string, edits: SlideResultEdits) => {
    await updateCurrentProject((currentProject) =>
      updateProjectSlideResultEdits(currentProject, slideId, edits),
    )
  }

  const handleSaveArticle = async (draft: ArticleDraft) => {
    await updateCurrentProject((currentProject) => updateProjectArticleDraft(currentProject, draft))
  }

  const handleSaveArticleSummary = async (summary: ArticleSummary) => {
    await updateCurrentProject((currentProject) =>
      updateProjectArticleSummary(currentProject, summary),
    )
  }

  const handleOpenGenerateNotes = () => {
    if (!project?.slideDetection) return
    void handleProjectStep('generate-notes')
  }

  if (step === 'home') {
    return (
      <HomePage
        onHome={handleGoHome}
        onCreateProject={handleCreateProject}
        onOpenProject={handleOpenProject}
        onRelinkProject={relinkProject}
        onDeleteProject={removeProject}
      />
    )
  }

  if (step === 'article-review' && project) {
    return (
      <ArticleReviewPage
        project={project}
        onBack={() => void handleProjectStep('generate-notes')}
        onSave={handleSaveArticle}
        onSaveSummary={handleSaveArticleSummary}
        onExport={() => void handleProjectStep('export')}
        onHome={handleGoHome}
      />
    )
  }

  if (step === 'export' && project) {
    return (
      <ExportPage
        project={project}
        onBack={() => void handleProjectStep('article-review')}
        onHome={handleGoHome}
      />
    )
  }

  if (step === 'generate-notes' && project) {
    return (
      <GenerateNotesPage
        project={project}
        onBack={() => setStep('detect-slides')}
        onCompleted={handleTranscriptionCompleted}
        onOcrSlideCompleted={handleOcrSlideCompleted}
        onContentSlideCompleted={handleContentSlideCompleted}
        onTranscriptAlignmentCompleted={handleTranscriptAlignmentCompleted}
        onTranscriptPlacementChange={handleTranscriptPlacementChange}
        onSaveSlideResultEdits={handleSaveSlideResultEdits}
        onOpenArticleReview={() => void handleProjectStep('article-review')}
        onHome={handleGoHome}
      />
    )
  }

  if (step === 'detect-slides' && project) {
    return (
      <SlideDetectionPage
        project={project}
        onBack={() => setStep('crop')}
        onCompleted={handleSlideDetectionCompleted}
        onContinue={handleOpenGenerateNotes}
        onHome={handleGoHome}
      />
    )
  }

  if (step === 'crop' && project) {
    return (
      <CropPage
        project={project}
        onBack={() => setStep('import')}
        onApply={handleApplyCrop}
        onHome={handleGoHome}
      />
    )
  }

  const initialVideo = project
    ? {
        name: project.source.name,
        path: project.source.path,
        extension: project.source.extension,
        sizeBytes: project.source.sizeBytes,
        metadata: project.source.metadata,
        origin: project.source.origin,
      }
    : undefined

  return (
    <ImportPage
      initialVideo={initialVideo}
      onContinue={handleImportContinue}
      onContinueYoutube={handleYoutubeImport}
      onHome={handleGoHome}
    />
  )
}

export default App
