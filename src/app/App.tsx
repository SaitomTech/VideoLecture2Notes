import { useRef, useState } from 'react'
import { ArticleReviewPage } from '../features/article/ArticleReviewPage'
import { CropPage } from '../features/crop/CropPage'
import { ExportPage } from '../features/export/ExportPage'
import { GenerateNotesPage } from '../features/generate-notes/GenerateNotesPage'
import { ImportPage } from '../features/import/ImportPage'
import { SlideDetectionPage } from '../features/slide-detection/SlideDetectionPage'
import {
  createMediaProject,
  updateProjectArticleDraft,
  updateProjectCrop,
  updateProjectSlideArticle,
  updateProjectSlideCorrection,
  updateProjectSlideDetection,
  updateProjectSlideOcr,
  updateProjectTranscription,
} from '../lib/project/project'
import { saveProject } from '../lib/storage/projectStorage'
import type { SelectedVideo } from '../features/import/types'
import type {
  ArticleDraft,
  ArticleFormattingResult,
  CropRegion,
  MediaProject,
  SlideOcrResult,
  TranscriptCorrectionResult,
  TranscriptionResult,
} from '../types/project'
import type { SlideDetectionOutput } from '../features/slide-detection/types'

type AppStep = 'import' | 'crop' | 'detect-slides' | 'generate-notes' | 'article-review' | 'export'

function App() {
  const [step, setStep] = useState<AppStep>('import')
  const [project, setProject] = useState<MediaProject | null>(null)
  const projectRef = useRef<MediaProject | null>(null)

  const persistProject = async (nextProject: MediaProject) => {
    await saveProject(nextProject)
    projectRef.current = nextProject
    setProject(nextProject)
  }

  const updateCurrentProject = async (
    update: (currentProject: MediaProject) => MediaProject,
  ) => {
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

  const handleCorrectionSlideCompleted = async (
    slideId: string,
    correction: TranscriptCorrectionResult,
  ) => {
    await updateCurrentProject((currentProject) =>
      updateProjectSlideCorrection(currentProject, slideId, correction),
    )
  }

  const handleArticleSlideCompleted = async (
    slideId: string,
    article: ArticleFormattingResult,
  ) => {
    await updateCurrentProject((currentProject) =>
      updateProjectSlideArticle(currentProject, slideId, article),
    )
  }

  const handleSaveArticle = async (draft: ArticleDraft) => {
    await updateCurrentProject((currentProject) => updateProjectArticleDraft(currentProject, draft))
  }

  const handleOpenGenerateNotes = () => {
    if (!project?.slideDetection) return
    setStep('generate-notes')
  }

  if (step === 'article-review' && project) {
    return (
      <ArticleReviewPage
        project={project}
        onBack={() => setStep('generate-notes')}
        onSave={handleSaveArticle}
        onExport={() => setStep('export')}
      />
    )
  }

  if (step === 'export' && project) {
    return <ExportPage project={project} onBack={() => setStep('article-review')} />
  }

  if (step === 'generate-notes' && project) {
    return (
      <GenerateNotesPage
        project={project}
        onBack={() => setStep('detect-slides')}
        onCompleted={handleTranscriptionCompleted}
        onOcrSlideCompleted={handleOcrSlideCompleted}
        onCorrectionSlideCompleted={handleCorrectionSlideCompleted}
        onArticleSlideCompleted={handleArticleSlideCompleted}
        onOpenArticleReview={() => setStep('article-review')}
      />
    )
  }

  if (step === 'detect-slides' && project) {
    return <SlideDetectionPage project={project} onBack={() => setStep('crop')} onCompleted={handleSlideDetectionCompleted} onContinue={handleOpenGenerateNotes} />
  }

  if (step === 'crop' && project) {
    return <CropPage project={project} onBack={() => setStep('import')} onApply={handleApplyCrop} />
  }

  const initialVideo = project
    ? {
        name: project.source.name,
        path: project.source.path,
        extension: project.source.extension,
        sizeBytes: project.source.sizeBytes,
        metadata: project.source.metadata,
      }
    : undefined

  return <ImportPage initialVideo={initialVideo} onContinue={handleImportContinue} />
}

export default App
