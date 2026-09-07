import { trimVideo } from '../../lib/media/ffmpeg'
import { probeVideo } from '../../lib/media/ffprobe'
import { getTrimmedVideoAssetPath } from '../../lib/storage/projectAssets'
import { getFileSize } from '../../lib/tauri/filesystem'
import type { MediaProject, VideoTrim, VideoTrimRange } from '../../types/project'
import { clampTrimRange } from './utils'

export function normalizeTrimRange(range: VideoTrimRange, durationMs: number): VideoTrimRange {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error('動画の長さを確認できませんでした。')
  }
  return clampTrimRange(range, durationMs)
}

export function isFullTrimRange(range: VideoTrimRange, durationMs: number) {
  return range.startMs === 0 && range.endMs >= durationMs - 100
}

export async function createTrimmedVideo(
  project: MediaProject,
  range: VideoTrimRange,
): Promise<VideoTrim> {
  const normalizedRange = normalizeTrimRange(range, project.source.metadata.durationMs)
  if (isFullTrimRange(normalizedRange, project.source.metadata.durationMs)) {
    throw new Error('全範囲を選択した場合、トリム済み動画の作成は必要ありません。')
  }

  const outputPath = await getTrimmedVideoAssetPath(project.id)
  await trimVideo({
    path: project.source.path,
    outputPath,
    startMs: normalizedRange.startMs,
    endMs: normalizedRange.endMs,
  })
  const [metadata, sizeBytes] = await Promise.all([
    probeVideo(outputPath),
    getFileSize(outputPath),
  ])

  return {
    ...normalizedRange,
    source: {
      ...project.source,
      path: outputPath,
      name: `${project.source.name.replace(/\.[^.]+$/, '')}-trimmed.mp4`,
      extension: 'mp4',
      sizeBytes,
      metadata,
    },
  }
}
