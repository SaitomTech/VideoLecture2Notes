import { executeSidecar } from '../tauri/sidecar'
import type { YoutubeVideoInfo } from './types'
import { parseYoutubeUrl } from './url'

type YoutubeInfoJson = {
  title?: unknown
  channel?: unknown
  uploader?: unknown
  thumbnail?: unknown
  duration?: unknown
  is_live?: unknown
  live_status?: unknown
}

function parseNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseInfoJson(stdout: string): YoutubeInfoJson {
  const start = stdout.indexOf('{')
  const end = stdout.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('YouTubeの動画情報を解析できませんでした。')

  try {
    return JSON.parse(stdout.slice(start, end + 1)) as YoutubeInfoJson
  } catch {
    throw new Error('YouTubeの動画情報を解析できませんでした。')
  }
}

function safeThumbnailUrl(value: unknown) {
  if (typeof value !== 'string') return undefined

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return undefined
    if (url.hostname !== 'ytimg.com' && !url.hostname.endsWith('.ytimg.com')) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

export async function getYoutubeVideoInfo(value: string): Promise<YoutubeVideoInfo> {
  const parsedUrl = parseYoutubeUrl(value)
  const output = await executeSidecar('binaries/yt-dlp', [
    '--dump-single-json',
    '--no-download',
    '--no-playlist',
    '--no-cache-dir',
    '--no-cookies',
    '--no-warnings',
    parsedUrl.canonicalUrl,
  ])

  if (output.code !== 0) {
    const detail = output.stderr.trim()
    throw new Error(detail || 'YouTube動画の情報を取得できませんでした。')
  }

  const info = parseInfoJson(output.stdout)
  const title = typeof info.title === 'string' ? info.title.trim() : ''
  const durationSeconds = parseNumber(info.duration)
  const isLive = info.is_live === true || info.live_status === 'is_live'

  if (!title || durationSeconds === undefined || durationSeconds <= 0 || isLive) {
    throw new Error('公開済みの動画情報を取得できませんでした。ライブ配信中の動画は対象外です。')
  }

  const channelTitle =
    typeof info.channel === 'string'
      ? info.channel.trim()
      : typeof info.uploader === 'string'
        ? info.uploader.trim()
        : ''

  return {
    videoId: parsedUrl.videoId,
    canonicalUrl: parsedUrl.canonicalUrl,
    title,
    ...(channelTitle ? { channelTitle } : {}),
    thumbnailUrl: safeThumbnailUrl(info.thumbnail),
    durationMs: Math.max(0, Math.round(durationSeconds * 1000)),
  }
}
