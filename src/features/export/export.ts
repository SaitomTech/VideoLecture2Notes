import { join } from '@tauri-apps/api/path'
import { copyFile, ensureDirectory, writeTextFile } from '../../lib/tauri/filesystem'
import { hasCurrentArticleSummary } from '../article/article'
import { getActiveMediaSource, type ArticleSummary, type MediaProject } from '../../types/project'
import { renderHtml, renderMarkdown, renderTxt } from './renderers'

export const EXPORT_OPTIONS = [
  { format: 'html', label: 'HTML', filename: 'index.html', description: '画像付きの記事ページ' },
  {
    format: 'markdown',
    label: 'Markdown',
    filename: 'notes.md',
    description: '画像付きのMarkdown',
  },
  { format: 'txt', label: 'TXT', filename: 'notes.txt', description: '画像なしのプレーンテキスト' },
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
  summary?: ArticleSummary
  sections: ExportSection[]
}

const EXPORT_RENDERERS: Record<ExportFormat, (document: ExportDocument) => string> = {
  html: renderHtml,
  markdown: renderMarkdown,
  txt: renderTxt,
}

function defaultArticleTitle(project: MediaProject) {
  return project.article?.title?.trim() || project.source.name.replace(/\.[^.]+$/, '')
}

function imageFilename(index: number) {
  return `slide-${String(index + 1).padStart(3, '0')}.jpg`
}

function buildExportDocument(project: MediaProject, includeImages: boolean): ExportDocument {
  if (project.slides.length === 0) {
    throw new Error('ExportするSlideがありません。先にスライド検出を実行してください。')
  }

  const missingImageSlide = includeImages
    ? project.slides.find((slide) => !slide.image.representativeFramePath)
    : undefined
  if (missingImageSlide) {
    throw new Error(
      `Slide ${missingImageSlide.index + 1}の代表画像がありません。スライド検出をもう一度実行してください。`,
    )
  }

  const source = getActiveMediaSource(project)

  return {
    title: defaultArticleTitle(project),
    sourceName: source.name,
    durationMs: source.metadata.durationMs,
    summary:
      project.article?.summary &&
      hasCurrentArticleSummary(project, project.article.summary.model)
        ? project.article.summary
        : undefined,
    sections: project.slides.map((slide) => ({
      id: slide.id,
      index: slide.index,
      startMs: slide.startMs,
      endMs: slide.endMs,
      imagePath: slide.image.representativeFramePath ? `./assets/${imageFilename(slide.index)}` : '',
      sourceImagePath: slide.image.representativeFramePath ?? '',
      ocrText: slide.ocr?.rawText ?? '',
      transcriptRaw: slide.transcript?.raw ?? '',
      body: slide.transcript?.articleBody ?? '',
    })),
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

  const files = EXPORT_OPTIONS.filter((file) => formats.includes(file.format))
  const includeImages = formats.some((format) => format === 'html' || format === 'markdown')
  const document = buildExportDocument(project, includeImages)
  const total = (includeImages ? document.sections.length : 0) + files.length
  let completed = 0
  const report = (stage: ExportProgress['stage']) => onProgress?.({ stage, completed, total })

  await ensureDirectory(destination)

  if (includeImages) {
    const assetsDirectory = await join(destination, 'assets')
    await ensureDirectory(assetsDirectory)

    report('copying-images')
    await Promise.all(
      document.sections.map(async (section) => {
        await copyFile(section.sourceImagePath, await join(assetsDirectory, imageFilename(section.index)))
        completed += 1
        report('copying-images')
      }),
    )
  }

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
