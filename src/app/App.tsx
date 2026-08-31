import { useState } from 'react'
import { CropPage } from '../features/crop/CropPage'
import { GenerateNotesPage } from '../features/generate-notes/GenerateNotesPage'
import { ImportPage } from '../features/import/ImportPage'
import { SlideDetectionPage } from '../features/slide-detection/SlideDetectionPage'
import { createMediaProject, updateProjectCrop, updateProjectSlideDetection, updateProjectTranscription } from '../lib/project/project'
import { saveProject } from '../lib/storage/projectStorage'
import type { SelectedVideo } from '../features/import/types'
import type { CropRegion, MediaProject, TranscriptionResult } from '../types/project'
import type { SlideDetectionOutput } from '../features/slide-detection/types'

type AppStep = 'import' | 'crop' | 'detect-slides' | 'generate-notes'

function App() {
  const [step, setStep] = useState<AppStep>('import')
  const [project, setProject] = useState<MediaProject | null>(null)

  const handleImportContinue = async (video: SelectedVideo) => {
    if (!video.metadata) throw new Error('動画メタデータがありません')

    const nextProject = createMediaProject(video, video.metadata)
    await saveProject(nextProject)
    setProject(nextProject)
    setStep('crop')
  }

  const handleApplyCrop = async (crop: CropRegion) => {
    if (!project) return

    const nextProject = updateProjectCrop(project, crop)
    await saveProject(nextProject)
    setProject(nextProject)
    setStep('detect-slides')
  }

  const handleSlideDetectionCompleted = async (output: SlideDetectionOutput) => {
    if (!project) return

    const nextProject = updateProjectSlideDetection(project, output.result, output.slides)
    await saveProject(nextProject)
    setProject(nextProject)
  }

  const handleTranscriptionCompleted = async (transcription: TranscriptionResult) => {
    if (!project) return

    const nextProject = updateProjectTranscription(project, transcription)
    await saveProject(nextProject)
    setProject(nextProject)
  }

  const handleOpenGenerateNotes = () => {
    if (!project?.slideDetection) return
    setStep('generate-notes')
  }

  if (step === 'generate-notes' && project) {
    return <GenerateNotesPage project={project} onBack={() => setStep('detect-slides')} onCompleted={handleTranscriptionCompleted} />
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
