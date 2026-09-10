import { useCallback, useRef, useState } from 'react'
import type { MediaProject } from '../../../types/project'
import {
  downloadAllExportFiles,
  downloadExportFile,
  exportProject,
  type ExportFormat,
  type ExportProgress,
  type ExportResult,
} from '../export'

type ExportStatus = 'idle' | 'running' | 'completed' | 'error'

export function useExport(project: MediaProject) {
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [progress, setProgress] = useState<ExportProgress>({
    stage: 'copying-images',
    completed: 0,
    total: 0,
  })
  const [result, setResult] = useState<ExportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isGenerating = useRef(false)

  const generate = useCallback(async () => {
    if (isGenerating.current) return

    isGenerating.current = true
    setStatus('running')
    setError(null)
    setResult(null)
    setProgress({ stage: 'copying-images', completed: 0, total: 0 })

    try {
      const output = await exportProject(project, setProgress)
      setResult(output)
      setStatus('completed')
    } catch (exportError) {
      console.error(exportError)
      setStatus('error')
      setError(exportError instanceof Error ? exportError.message : '書き出しに失敗しました。')
    } finally {
      isGenerating.current = false
    }
  }, [project])

  const download = useCallback(
    async (format: ExportFormat) => {
      if (!result) return false
      const file = result.files.find((candidate) => candidate.format === format)
      if (!file) return false
      return downloadExportFile(file, result.assets)
    },
    [result],
  )

  const downloadAll = useCallback(async () => {
    if (!result) return false
    return downloadAllExportFiles(result.files, result.assets)
  }, [result])

  return {
    status,
    progress,
    files: result?.files ?? [],
    previewHtml: result?.previewHtml ?? null,
    error,
    generate,
    download,
    downloadAll,
  }
}

export type ExportController = ReturnType<typeof useExport>
