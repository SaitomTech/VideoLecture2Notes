import { convertFileSrc } from '@tauri-apps/api/core'
import { appLocalDataDir, dirname, join } from '@tauri-apps/api/path'
import { open, save } from '@tauri-apps/plugin-dialog'
import { copyFile, ensureDirectory, writeTextFile } from '../../lib/tauri/filesystem'
import { hasCurrentArticleSummary } from '../article/article'
import { getActiveMediaSource, type ArticleSummary, type MediaProject } from '../../types/project'
import { renderHtml, renderMarkdown, renderTxt } from './renderers'

export const EXPORT_OPTIONS = [
  { format: 'html', label: 'HTML', filename: 'index.html' },
  { format: 'markdown', label: 'Markdown', filename: 'notes.md' },
  { format: 'txt', label: 'TXT', filename: 'notes.txt' },
] as const

export type ExportFormat = (typeof EXPORT_OPTIONS)[number]['format']

export type ExportProgress = {
  stage: 'copying-images' | 'writing-files'
  completed: number
  total: number
}

export type ExportFile = {
  format: ExportFormat
  filename: string
  path: string
}

export type ExportAsset = {
  filename: string
  path: string
}

export type ExportResult = {
  files: ExportFile[]
  assets: ExportAsset[]
  previewHtml: string
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

function buildExportDocument(
  project: MediaProject,
  imagePathFor: (sourceImagePath: string, index: number) => string,
): ExportDocument {
  if (project.slides.length === 0) {
    throw new Error('書き出すSlideがありません。先にスライド検出を実行してください。')
  }

  const missingImageSlide = project.slides.find((slide) => !slide.image.representativeFramePath)
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
      project.article?.summary && hasCurrentArticleSummary(project, project.article.summary.model)
        ? project.article.summary
        : undefined,
    sections: project.slides.map((slide) => ({
      id: slide.id,
      index: slide.index,
      startMs: slide.startMs,
      endMs: slide.endMs,
      imagePath: imagePathFor(slide.image.representativeFramePath ?? '', slide.index),
      sourceImagePath: slide.image.representativeFramePath ?? '',
      ocrText: slide.ocr?.rawText ?? '',
      transcriptRaw: slide.transcript?.raw ?? '',
      body: slide.transcript?.articleBody ?? '',
    })),
  }
}

async function getExportDirectory(projectId: string) {
  return join(await appLocalDataDir(), 'projects', projectId, 'exports')
}

export async function exportProject(
  project: MediaProject,
  onProgress?: (progress: ExportProgress) => void,
): Promise<ExportResult> {
  const destination = await getExportDirectory(project.id)
  const document = buildExportDocument(
    project,
    (_sourceImagePath, index) => `./assets/${imageFilename(index)}`,
  )
  const total = document.sections.length + EXPORT_OPTIONS.length
  let completed = 0
  const report = (stage: ExportProgress['stage']) => onProgress?.({ stage, completed, total })

  await ensureDirectory(destination)

  const assetsDirectory = await join(destination, 'assets')
  await ensureDirectory(assetsDirectory)
  const assets = await Promise.all(
    document.sections.map(async (section) => ({
      filename: imageFilename(section.index),
      path: await join(assetsDirectory, imageFilename(section.index)),
    })),
  )

  report('copying-images')
  await Promise.all(
    document.sections.map(async (section, sectionIndex) => {
      await copyFile(section.sourceImagePath, assets[sectionIndex].path)
      completed += 1
      report('copying-images')
    }),
  )

  report('writing-files')
  const files = await Promise.all(
    EXPORT_OPTIONS.map(async (file) => ({
      format: file.format,
      filename: file.filename,
      path: await join(destination, file.filename),
    })),
  )
  await Promise.all(
    files.map(async (file) => {
      await writeTextFile(file.path, EXPORT_RENDERERS[file.format](document))
      completed += 1
      report('writing-files')
    }),
  )

  const previewDocument = buildExportDocument(project, (sourceImagePath) =>
    convertFileSrc(sourceImagePath),
  )

  return {
    files,
    assets,
    previewHtml: renderHtml(previewDocument),
  }
}

async function copyExportAssets(assets: ExportAsset[], destinationDirectory: string) {
  await ensureDirectory(destinationDirectory)
  await Promise.all(
    assets.map(async (asset) =>
      copyFile(asset.path, await join(destinationDirectory, asset.filename)),
    ),
  )
}

export async function downloadExportFile(file: ExportFile, assets: ExportAsset[]) {
  const destination = await save({
    defaultPath: file.filename,
    title: `${file.filename}を保存`,
  })
  if (!destination) return false

  await copyFile(file.path, destination)
  if (file.format === 'html' || file.format === 'markdown') {
    await copyExportAssets(assets, await join(await dirname(destination), 'assets'))
  }
  return true
}

export async function downloadAllExportFiles(files: ExportFile[], assets: ExportAsset[]) {
  const selected = await open({
    multiple: false,
    directory: true,
    title: '書き出し結果の保存先フォルダを選択',
  })
  if (typeof selected !== 'string') return false

  await Promise.all(
    files.map(async (file) => copyFile(file.path, await join(selected, file.filename))),
  )
  await copyExportAssets(assets, await join(selected, 'assets'))
  return true
}
