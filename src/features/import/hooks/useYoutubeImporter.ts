import { useState } from 'react'
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
      setUrl(parsed.canonicalUrl)
      setStatus('resolving')
      const nextInfo = await getYoutubeVideoInfo(parsed.canonicalUrl)
      setInfo(nextInfo)
      setStatus('ready')
    } catch (resolveError) {
      console.error(resolveError)
      setStatus('error')
      setError(
        resolveError instanceof Error
          ? resolveError.message
          : 'YouTube動画の情報を取得できませんでした。',
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
