import { useState } from 'react'
import type { MediaProject } from '../../../types/project'
import { exportProject, type ExportFormat, type ExportProgress } from '../export'

type ExportStatus = 'idle' | 'running' | 'completed' | 'error'

export function useExport(project: MediaProject) {
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [progress, setProgress] = useState<ExportProgress>({
    stage: 'copying-images',
    completed: 0,
    total: 0,
  })
  const [files, setFiles] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  async function exportNotes(destination: string, formats: ExportFormat[]) {
    setStatus('running')
    setError(null)
    setFiles([])
    setProgress({ stage: 'copying-images', completed: 0, total: 0 })

    try {
      const outputFiles = await exportProject(project, destination, formats, setProgress)
      setFiles(outputFiles)
      setStatus('completed')
    } catch (exportError) {
      console.error(exportError)
      setStatus('error')
      setError(exportError instanceof Error ? exportError.message : 'Exportに失敗しました。')
    }
  }

  return { status, progress, files, error, exportNotes }
}

export type ExportController = ReturnType<typeof useExport>
