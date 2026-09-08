const MEDIA_ERROR_LABELS: Record<number, string> = {
  1: '読み込みが中断されました',
  2: '動画ファイルを読み込めませんでした',
  3: '動画をデコードできませんでした',
  4: 'この動画ソースはWebViewで再生できません',
}

function thrownErrorDetails(error: unknown) {
  if (error instanceof DOMException)
    return `${error.name}${error.message ? `: ${error.message}` : ''}`
  if (error instanceof Error) return `${error.name}: ${error.message}`
  if (typeof error === 'string' && error) return error
  return null
}

/** Creates an actionable diagnostic while keeping the browser's media details intact. */
export function describeVideoPlaybackError(video: HTMLMediaElement, error?: unknown) {
  const mediaError = video.error
  const mediaDetails = mediaError
    ? `MediaError code=${mediaError.code}${MEDIA_ERROR_LABELS[mediaError.code] ? `（${MEDIA_ERROR_LABELS[mediaError.code]}）` : ''}${mediaError.message ? `: ${mediaError.message}` : ''}`
    : null
  const thrownDetails = thrownErrorDetails(error)
  const stateDetails = `readyState=${video.readyState}, networkState=${video.networkState}`
  const detail = mediaDetails ?? thrownDetails ?? '原因を取得できませんでした'

  return `動画を再生できませんでした（${detail}; ${stateDetails}）。`
}

export function logVideoPlaybackError(video: HTMLMediaElement, error?: unknown) {
  console.error('Video playback failed', {
    error,
    mediaError: video.error
      ? {
          code: video.error.code,
          message: video.error.message,
        }
      : null,
    currentSrc: video.currentSrc,
    readyState: video.readyState,
    networkState: video.networkState,
  })
}
