import { join } from '@tauri-apps/api/path'
import { getFileSize, removeAbsolutePath, renameAbsolutePath } from '../tauri/filesystem'
import { executeSidecarStreaming, getBundledFfmpegPath } from '../tauri/sidecar'
import { convertVideoForWebView, getWebViewFormatAdjustment } from '../media/ffmpeg'
import { probeVideo } from '../media/ffprobe'
import { prepareProjectSourceAssetDirectory } from '../storage/projectAssets'
import type { SelectedVideo } from '../../features/import/types'
import { getExtension, isSupportedVideo } from '../../features/import/utils'
import type { VideoExtension, VideoFormatAdjustment } from '../../types/media'
import type { YoutubeDownloadInput, YoutubeDownloadProgress } from './types'

export const YT_DLP_VERSION = '2026.08.19'

const PROGRESS_PREFIX = 'VLN_PROGRESS:'
const RESULT_PREFIX = 'VLN_RESULT:'

function parseProgress(chunk: string): YoutubeDownloadProgress | null {
  const line = chunk
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find((value) => value.startsWith(PROGRESS_PREFIX))
  if (!line) return null

  const [percentValue, speed, eta] = line.slice(PROGRESS_PREFIX.length).split('|')
  const percent = Number(percentValue)
  return {
    stage: 'downloading',
    ...(Number.isFinite(percent) ? { percent } : {}),
    ...(speed && speed !== 'NA' ? { speed } : {}),
    ...(eta && eta !== 'NA' ? { eta } : {}),
  }
}

function printedOutputPath(stdout: string, sourceDirectory: string) {
  const line = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .reverse()
    .find((line) => line.startsWith(RESULT_PREFIX))
  if (!line) return undefined

  let outputPath: unknown
  try {
    outputPath = JSON.parse(line.slice(RESULT_PREFIX.length))
  } catch {
    return undefined
  }

  return typeof outputPath === 'string' && outputPath.startsWith(`${sourceDirectory}/source.`)
    ? outputPath
    : undefined
}

function safeSourceName(title: string, extension: VideoExtension, videoId: string) {
  const printableTitle = Array.from(title)
    .filter((character) => character >= ' ' && character !== '\u007f')
    .join('')
  const cleaned = printableTitle
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)

  return `${cleaned || `youtube-${videoId}`}.${extension}`
}

function formatForQuality(quality: YoutubeDownloadInput['quality']) {
  const height = quality === 'best' ? '' : `[height<=${quality.replace('p', '')}]`

  return [
    `bv[ext=mp4][vcodec^=avc1]${height}+ba[ext=m4a][acodec^=mp4a]`,
    `bv[ext=mp4][vcodec^=avc1]${height}+ba[ext=m4a]`,
    `b[ext=mp4][vcodec^=avc1][acodec^=mp4a]${height}`,
    `bv[ext=mp4][vcodec^=avc1]${height}+ba`,
    `b[ext=mp4][vcodec^=avc1]${height}`,
    `bv${height}+ba`,
    `b${height}`,
  ].join('/')
}

function hasFormatAdjustment(adjustment: VideoFormatAdjustment) {
  return adjustment.container || adjustment.video || adjustment.audio
}

export async function downloadYoutubeVideo({
  projectId,
  info,
  quality,
  signal,
  onProgress,
}: YoutubeDownloadInput): Promise<SelectedVideo> {
  const [sourceDirectory, ffmpegPath] = await Promise.all([
    prepareProjectSourceAssetDirectory(projectId),
    getBundledFfmpegPath(),
  ])
  const outputTemplate = await join(sourceDirectory, 'source.%(ext)s')

  const output = await executeSidecarStreaming(
    'binaries/yt-dlp',
    [
      '--ignore-config',
      '--no-playlist',
      '--no-cookies',
      '--no-cache-dir',
      '--no-simulate',
      '--newline',
      '--progress',
      '--progress-template',
      `download:${PROGRESS_PREFIX}%(progress._percent)s|%(progress._speed_str)s|%(progress._eta_str)s`,
      '--no-warnings',
      '--format',
      formatForQuality(quality),
      '--output',
      outputTemplate,
      '--print',
      `after_move:${RESULT_PREFIX}%(filepath)j`,
      '--ffmpeg-location',
      ffmpegPath,
      info.canonicalUrl,
    ],
    {
      signal,
      onStdout: (chunk) => {
        const progress = parseProgress(chunk)
        if (progress) onProgress?.(progress)
      },
      onStderr: (chunk) => {
        const progress = parseProgress(chunk)
        if (progress) onProgress?.(progress)
      },
    },
  )

  if (output.code !== 0) {
    const detail = output.stderr.trim()
    throw new Error(detail || 'YouTube動画の取得に失敗しました。')
  }

  const outputPath = printedOutputPath(output.stdout, sourceDirectory)
  if (!outputPath) throw new Error('取得した動画ファイルを確認できませんでした。')

  const downloadedFileSize = await getFileSize(outputPath)
  if (downloadedFileSize <= 0) throw new Error('取得した動画ファイルが空です。')

  onProgress?.({ stage: 'checking' })
  const downloadedMetadata = await probeVideo(outputPath)
  if (downloadedMetadata.durationMs <= 0 || !downloadedMetadata.audioCodec) {
    throw new Error('取得した動画に必要な映像・音声トラックがありません。')
  }

  const adjustment = getWebViewFormatAdjustment(outputPath, downloadedMetadata)
  let finalPath = outputPath
  let metadata = downloadedMetadata

  if (hasFormatAdjustment(adjustment)) {
    const compatiblePath = await join(sourceDirectory, 'source.compatible.mp4')
    onProgress?.({
      stage: 'converting',
      adjustment,
    })
    await convertVideoForWebView({
      path: outputPath,
      outputPath: compatiblePath,
      adjustment,
      signal,
    })

    onProgress?.({ stage: 'checking' })
    const compatibleMetadata = await probeVideo(compatiblePath)
    const remainingAdjustment = getWebViewFormatAdjustment(compatiblePath, compatibleMetadata)
    if (hasFormatAdjustment(remainingAdjustment)) {
      throw new Error('動画をWebView対応形式に調整した結果を確認できませんでした。')
    }

    finalPath = await join(sourceDirectory, 'source.mp4')
    await renameAbsolutePath(compatiblePath, finalPath)
    if (outputPath !== finalPath) await removeAbsolutePath(outputPath)
    metadata = { ...compatibleMetadata, path: finalPath }
  }

  const fileName = finalPath.split(/[\\/]/).pop() ?? finalPath
  if (!isSupportedVideo(fileName)) throw new Error('取得した映像形式には対応していません。')

  const extension = getExtension(fileName) as VideoExtension
  const fileSize = await getFileSize(finalPath)
  onProgress?.({ stage: 'saving' })

  return {
    name: safeSourceName(info.title, extension, info.videoId),
    path: finalPath,
    extension,
    sizeBytes: fileSize,
    metadata,
    origin: {
      kind: 'youtube',
      originalUrl: info.originalUrl,
      videoId: info.videoId,
      canonicalUrl: info.canonicalUrl,
      pageTitle: info.title,
      channelTitle: info.channelTitle,
      thumbnailUrl: info.thumbnailUrl,
      importedAt: new Date().toISOString(),
      downloader: {
        name: 'yt-dlp',
        version: YT_DLP_VERSION,
      },
      quality,
    },
  }
}
