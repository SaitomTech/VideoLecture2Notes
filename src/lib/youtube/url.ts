const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

export type ParsedYoutubeUrl = {
  originalUrl: string
  videoId: string
  canonicalUrl: string
}

function normalizeInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('YouTube URLを入力してください。')

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function invalidUrl() {
  return new Error(
    '対応しているYouTube動画URLを入力してください。プレイリストやチャンネルURLは対象外です。',
  )
}

export function parseYoutubeUrl(value: string): ParsedYoutubeUrl {
  const originalUrl = normalizeInput(value)
  let url: URL
  try {
    url = new URL(originalUrl)
  } catch {
    throw invalidUrl()
  }

  if (url.protocol !== 'https:') throw invalidUrl()

  const hostname = url.hostname.toLowerCase()
  let videoId: string | undefined

  if (hostname === 'youtu.be') {
    videoId = url.pathname.split('/').filter(Boolean)[0]
  } else if (
    hostname === 'youtube.com' ||
    hostname === 'www.youtube.com' ||
    hostname === 'm.youtube.com' ||
    hostname === 'music.youtube.com'
  ) {
    const pathParts = url.pathname.split('/').filter(Boolean)
    if (url.pathname === '/watch') videoId = url.searchParams.get('v') ?? undefined
    if (['shorts', 'embed', 'live'].includes(pathParts[0] ?? '')) videoId = pathParts[1]
  }

  if (!videoId || !YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) throw invalidUrl()

  return {
    originalUrl,
    videoId,
    canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
  }
}
