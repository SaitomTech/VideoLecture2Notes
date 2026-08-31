import { useRef, useState } from 'react'
import { CropPage } from '../features/crop/CropPage'
import { GenerateNotesPage } from '../features/generate-notes/GenerateNotesPage'
import { ImportPage } from '../features/import/ImportPage'
import { SlideDetectionPage } from '../features/slide-detection/SlideDetectionPage'
import {
  createMediaProject,
  updateProjectCrop,
  updateProjectSlideDetection,
  updateProjectSlideOcr,
  updateProjectTranscription,
} from '../lib/project/project'
import { saveProject } from '../lib/storage/projectStorage'
import type { SelectedVideo } from '../features/import/types'
import type { CropRegion, MediaProject, SlideOcrResult, TranscriptionResult } from '../types/project'
import type { SlideDetectionOutput } from '../features/slide-detection/types'

type AppStep = 'import' | 'crop' | 'detect-slides' | 'generate-notes'

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

  const handleOpenGenerateNotes = () => {
    if (!project?.slideDetection) return
    setStep('generate-notes')
  }

  if (step === 'generate-notes' && project) {
    return (
      <GenerateNotesPage
        project={project}
        onBack={() => setStep('detect-slides')}
        onCompleted={handleTranscriptionCompleted}
        onOcrSlideCompleted={handleOcrSlideCompleted}
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
