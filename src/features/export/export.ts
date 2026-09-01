import { join } from '@tauri-apps/api/path'
import { copyFile, ensureDirectory, writeTextFile } from '../../lib/tauri/filesystem'
import { hasCurrentArticle } from '../article/article'
import type { MediaProject, TranscriptSegment } from '../../types/project'
import { renderHtml, renderJson, renderMarkdown, renderSrt } from './renderers'

export const EXPORT_OPTIONS = [
  { format: 'html', label: 'HTML', filename: 'index.html', description: '画像付きの記事ページ' },
  {
    format: 'markdown',
    label: 'Markdown',
    filename: 'notes.md',
    description: '画像付きのMarkdown',
  },
  { format: 'json', label: 'JSON', filename: 'notes.json', description: '編集・再利用用のデータ' },
  {
    format: 'srt',
    label: 'SRT',
    filename: 'transcript.srt',
    description: 'タイムスタンプ付き字幕',
  },
] as const

export type ExportFormat = (typeof EXPORT_OPTIONS)[number]['format']

export type ExportProgress = {
  stage: 'copying-images' | 'writing-files'
  completed: number
  total: number
}

export type ExportSection = {
  id: string
  index: number
  startMs: number
  endMs: number
  imagePath: string
  sourceImagePath: string
  ocrText: string
  transcriptRaw: string
  body: string
}

export type ExportDocument = {
  title: string
  sourceName: string
  durationMs: number
  sections: ExportSection[]
  transcriptSegments: TranscriptSegment[]
}

const EXPORT_RENDERERS: Record<ExportFormat, (document: ExportDocument) => string> = {
  html: renderHtml,
  markdown: renderMarkdown,
  json: renderJson,
  srt: renderSrt,
}

function defaultArticleTitle(project: MediaProject) {
  return project.article?.title?.trim() || project.source.name.replace(/\.[^.]+$/, '')
}

function imageFilename(index: number) {
  return `slide-${String(index + 1).padStart(3, '0')}.jpg`
}

function buildExportDocument(project: MediaProject): ExportDocument {
  if (project.slides.length === 0) {
    throw new Error('ExportするSlideがありません。先にスライド検出を実行してください。')
  }

  if (!project.slides.some((slide) => hasCurrentArticle(slide))) {
    throw new Error('Exportする記事本文がありません。先に記事本文を生成してください。')
  }

  const incompleteSlide = project.slides.find(
    (slide) => slide.transcript?.raw.trim() && !hasCurrentArticle(slide),
  )
  if (incompleteSlide) {
    throw new Error(`Slide ${incompleteSlide.index + 1}の記事本文が未生成です。記事本文の生成を完了してください。`)
  }

  const missingImageSlide = project.slides.find((slide) => !slide.image.representativeFramePath)
  if (missingImageSlide) {
    throw new Error(
      `Slide ${missingImageSlide.index + 1}の代表画像がありません。スライド検出をもう一度実行してください。`,
    )
  }

  return {
    title: defaultArticleTitle(project),
    sourceName: project.source.name,
    durationMs: project.source.metadata.durationMs,
    sections: project.slides.map((slide) => ({
      id: slide.id,
      index: slide.index,
      startMs: slide.startMs,
      endMs: slide.endMs,
      imagePath: `./assets/${imageFilename(slide.index)}`,
      sourceImagePath: slide.image.representativeFramePath as string,
      ocrText: slide.ocr?.rawText ?? '',
      transcriptRaw: slide.transcript?.raw ?? '',
      body: slide.transcript?.articleBody ?? '',
    })),
    transcriptSegments: project.transcription?.segments ?? [],
  }
}

export async function exportProject(
  project: MediaProject,
  destination: string,
  formats: ExportFormat[],
  onProgress?: (progress: ExportProgress) => void,
) {
  if (!destination) throw new Error('Export先のフォルダを選択してください。')

  if (formats.length === 0) throw new Error('出力形式を1つ以上選択してください。')

  const document = buildExportDocument(project)
  if (formats.includes('srt') && document.transcriptSegments.length === 0) {
    throw new Error('SRTを出力するには文字起こし結果が必要です。')
  }

  const files = EXPORT_OPTIONS.filter((file) => formats.includes(file.format))
  const total = document.sections.length + files.length
  let completed = 0
  const report = (stage: ExportProgress['stage']) => onProgress?.({ stage, completed, total })

  const assetsDirectory = await join(destination, 'assets')
  await ensureDirectory(destination)
  await ensureDirectory(assetsDirectory)

  report('copying-images')
  await Promise.all(
    document.sections.map(async (section) => {
      await copyFile(section.sourceImagePath, await join(assetsDirectory, imageFilename(section.index)))
      completed += 1
      report('copying-images')
    }),
  )

  report('writing-files')
  await Promise.all(
    files.map(async (file) => {
      await writeTextFile(await join(destination, file.filename), EXPORT_RENDERERS[file.format](document))
      completed += 1
      report('writing-files')
    }),
  )

  return files.map((file) => file.filename)
}
