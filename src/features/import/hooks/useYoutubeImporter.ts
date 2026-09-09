import { useState } from 'react'
import { getErrorDetail } from '../../../lib/errors'
import { getYoutubeVideoInfo } from '../../../lib/youtube/metadata'
import { parseYoutubeUrl } from '../../../lib/youtube/url'
import type { YoutubeVideoInfo } from '../../../lib/youtube/types'
import type { YoutubeImportQuality } from '../../../types/project'
import type { YoutubeResolveStatus } from '../types'

export function useYoutubeImporter() {
  const [url, setUrl] = useState('')
  const [info, setInfo] = useState<YoutubeVideoInfo | null>(null)
  const [status, setStatus] = useState<YoutubeResolveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [quality, setQuality] = useState<YoutubeImportQuality>('720p')

  const changeUrl = (value: string) => {
    setUrl(value)
    setInfo(null)
    setStatus('idle')
    setError(null)
  }

  const resolve = async () => {
    setError(null)
    setInfo(null)

    try {
      const parsed = parseYoutubeUrl(url)
      setStatus('resolving')
      const nextInfo = await getYoutubeVideoInfo(parsed.originalUrl)
      setInfo(nextInfo)
      setStatus('ready')
    } catch (resolveError) {
      console.error(resolveError)
      setStatus('error')
      setError(
        `動画情報の取得に失敗しました: ${getErrorDetail(resolveError, '原因を特定できませんでした。')}`,
      )
    }
  }

  return {
    url,
    info,
    status,
    error,
    quality,
    changeUrl,
    resolve,
    setQuality,
  }
}
