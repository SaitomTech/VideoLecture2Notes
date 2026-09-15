import { probeVideo } from '../media/ffprobe'
import { extractVideoThumbnail, trimVideo } from '../media/ffmpeg'
import { copyFile, getFileSize } from '../tauri/filesystem'
import {
  getArticleInputPath,
  getArticleInputThumbnailPath,
  getProjectVideoPath,
  getProjectVideoThumbnailPath,
  removeArticleAssetDirectory,
  removeProjectVideoAssetDirectory,
  removeProjectVideoThumbnail,
  prepareArticleInputDirectory,
} from '../storage/projectAssets'
import { normalizeTrimRange, isFullTrimRange } from './videoRange'
import type { SelectedVideo } from '../../features/import/types'
import { DEFAULT_SETTINGS, projectWithVideos } from './project'
import type {
  Article,
  ArticleInputMedia,
  CropRegion,
  MediaProject,
  MediaSource,
  ProjectVideo,
  PerspectiveCrop,
  VideoTrimRange,
} from '../../types/project'

function relativeVideoPath(videoId: string, extension: string) {
  return `videos/${videoId}/original.${extension}`
}

function relativeArticleInputPath(
  articleId: string,
  kind: 'original' | 'prepared',
  extension: string,
) {
  return `articles/${articleId}/input/${kind}.${extension}`
}

function withManagedPath(source: MediaSource, path: string, managedRelativePath: string) {
  return {
    ...source,
    path,
    metadata: { ...source.metadata, path },
    ownership: 'managed' as const,
    managedRelativePath,
  }
}

function normalizeCropRegion(requested: CropRegion, metadata: MediaSource['metadata']): CropRegion {
  const sourceWidth = Math.max(1, Math.round(metadata.width))
  const sourceHeight = Math.max(1, Math.round(metadata.height))
  const x = Math.min(sourceWidth - 1, Math.max(0, Math.round(requested.x)))
  const y = Math.min(sourceHeight - 1, Math.max(0, Math.round(requested.y)))
  const right = Math.min(sourceWidth, Math.max(x + 1, Math.round(requested.x + requested.width)))
  const bottom = Math.min(sourceHeight, Math.max(y + 1, Math.round(requested.y + requested.height)))
  return { x, y, width: right - x, height: bottom - y }
}

export async function addProjectVideo(project: MediaProject, selected: SelectedVideo) {
  if (!selected.metadata) throw new Error('動画メタデータがありません。')
  const youtubeOrigin = selected.origin?.kind === 'youtube' ? selected.origin : null
  if (
    youtubeOrigin &&
    project.videos.some(
      (video) =>
        video.media.origin?.kind === 'youtube' &&
        video.media.origin.videoId === youtubeOrigin.videoId,
    )
  ) {
    throw new Error('このYouTube動画は、すでにプロジェクトへ追加されています。')
  }
  const videoId = crypto.randomUUID()
  const extension = selected.extension
  try {
    const outputPath = await getProjectVideoPath(project.id, videoId, extension)
    const thumbnailPath = await getProjectVideoThumbnailPath(project.id, videoId)
    const relativePath = relativeVideoPath(videoId, extension)
    await copyFile(selected.path, outputPath)
    let hasThumbnail = false
    try {
      await extractVideoThumbnail(outputPath, thumbnailPath)
      hasThumbnail = true
    } catch (error) {
      console.warn('動画サムネイルを生成できませんでした', error)
      await removeProjectVideoThumbnail(project.id, videoId).catch(() => undefined)
    }
    const metadata = { ...selected.metadata, path: outputPath }
    const source: MediaSource = {
      path: outputPath,
      name: selected.name,
      extension,
      sizeBytes: selected.sizeBytes,
      metadata,
      origin: selected.origin ?? { kind: 'local-file' },
    }
    const now = new Date().toISOString()
    const video: ProjectVideo = {
      id: videoId,
      title: selected.name.replace(/\.[^.]+$/, ''),
      media: {
        ...withManagedPath(source, outputPath, relativePath),
        ...(hasThumbnail ? { thumbnailPath } : {}),
      },
      createdAt: now,
      updatedAt: now,
    }
    return { project: projectWithVideos(project, [...project.videos, video]), video }
  } catch (error) {
    try {
      await removeProjectVideoAssetDirectory(project.id, videoId)
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        '動画追加後の一時ファイル回収に失敗しました。',
      )
    }
    throw error
  }
}

export async function createArticleFromRange(
  project: MediaProject,
  videoId: string,
  title: string,
  requestedRange: VideoTrimRange,
  requestedCrop: CropRegion,
  requestedPerspectiveCrop?: PerspectiveCrop,
): Promise<Article> {
  const video = project.videos.find((candidate) => candidate.id === videoId)
  if (!video) throw new Error('元動画が見つかりません。')
  const durationMs = video.media.metadata.durationMs
  const range = normalizeTrimRange(requestedRange, durationMs)
  const articleId = crypto.randomUUID()
  const fullRange = isFullTrimRange(range, durationMs)
  const crop = normalizeCropRegion(requestedCrop, video.media.metadata)
  const sourceWidth = Math.round(video.media.metadata.width)
  const sourceHeight = Math.round(video.media.metadata.height)
  const fullCrop =
    crop.x === 0 &&
    crop.y === 0 &&
    crop.width === sourceWidth &&
    crop.height === sourceHeight &&
    !requestedPerspectiveCrop
  const extension = fullRange && fullCrop ? video.media.extension : 'mp4'
  const kind = fullRange && fullCrop ? 'original' : 'prepared'

  try {
    await prepareArticleInputDirectory(project.id, articleId)
    const outputPath = await getArticleInputPath(project.id, articleId, kind, extension)
    const relativePath = relativeArticleInputPath(articleId, kind, extension)
    const thumbnailPath = await getArticleInputThumbnailPath(project.id, articleId)
    if (fullRange && fullCrop) {
      await copyFile(video.media.path, outputPath)
    } else {
      await trimVideo({
        path: video.media.path,
        outputPath,
        startMs: range.startMs,
        endMs: range.endMs,
        crop,
        perspectiveCrop: requestedPerspectiveCrop,
        metadata: video.media.metadata,
      })
    }
    const metadata =
      fullRange && fullCrop
        ? { ...video.media.metadata, path: outputPath }
        : await probeVideo(outputPath)
    await extractVideoThumbnail(outputPath, thumbnailPath)
    const sizeBytes = await getFileSize(outputPath)
    const inputMedia: ArticleInputMedia = {
      ...withManagedPath(
        {
          ...video.media,
          path: outputPath,
          name:
            fullRange && fullCrop
              ? video.media.name
              : `${video.media.name.replace(/\.[^.]+$/, '')}-prepared.mp4`,
          extension,
          sizeBytes,
          metadata,
        },
        outputPath,
        relativePath,
      ),
      thumbnailPath,
      preparedFromVideoId: video.id,
      preparation: fullRange && fullCrop ? 'copy' : 'prepared',
      preparedAt: new Date().toISOString(),
    }
    const now = new Date().toISOString()
    return {
      id: articleId,
      title: title.trim() || `記事 ${project.articles.length + 1}`,
      sourceVideoId: video.id,
      inputMedia,
      sourceRange: range,
      settings: DEFAULT_SETTINGS,
      slides: [],
      workflow: {
        lastVisitedStep: 'detect-slides',
        maxReachedStep: 'detect-slides',
        lastOpenedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    }
  } catch (error) {
    try {
      await removeArticleAssetDirectory(project.id, articleId)
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        '記事作成後の一時ファイル回収に失敗しました。',
      )
    }
    throw error
  }
}

export async function createArticlesFromRanges(
  project: MediaProject,
  videoId: string,
  ranges: Array<{
    title: string
    range: VideoTrimRange
  }>,
  crop: CropRegion,
  perspectiveCrop?: PerspectiveCrop,
) {
  const created: Article[] = []
  try {
    for (const item of ranges)
      created.push(
        await createArticleFromRange(
          project,
          videoId,
          item.title,
          item.range,
          crop,
          perspectiveCrop,
        ),
      )
    return created
  } catch (error) {
    try {
      await Promise.all(
        created.map((article) => removeArticleAssetDirectory(project.id, article.id)),
      )
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        '記事作成後の一時ファイル回収に失敗しました。',
      )
    }
    throw error
  }
}
