import {
  extractRepresentativeFrame,
  sampleVideoFrames,
  type FrameHash,
} from '../../lib/media/ffmpeg'
import { hammingDistance } from '../../lib/media/dhash'
import { getSlideAssetPath } from '../../lib/storage/projectAssets'
import {
  getActiveMediaSource,
  type MediaProject,
  type SlideBoundary,
  type SlideData,
} from '../../types/project'
import type { SlideDetectionOutput, SlideDetectionStage } from './types'

export const MINIMUM_BOUNDARY_GAP_MS = 1500

function frameDistance(first: FrameHash, second: FrameHash) {
  const hashDistance = hammingDistance(first.hash, second.hash)
  const lumaDistance =
    first.averageLuma === undefined || second.averageLuma === undefined
      ? 0
      : Math.round(Math.abs(first.averageLuma - second.averageLuma) / 8)
  return hashDistance + lumaDistance
}

type DetectBoundariesInput = {
  frames: FrameHash[]
  threshold: number
  minimumGapMs?: number
}

export function detectSlideBoundaries({
  frames,
  threshold,
  minimumGapMs = MINIMUM_BOUNDARY_GAP_MS,
}: DetectBoundariesInput): SlideBoundary[] {
  const boundaries: SlideBoundary[] = []
  const settleThreshold = Math.max(2, Math.floor(threshold / 2))
  let previousBoundaryMs = -minimumGapMs

  for (let index = 1; index < frames.length - 1; index += 1) {
    const previous = frames[index - 1]
    const current = frames[index]
    const next = frames[index + 1]
    const distance = frameDistance(previous, current)
    const settled = frameDistance(current, next) <= settleThreshold

    if (distance < threshold || !settled || current.timestampMs - previousBoundaryMs < minimumGapMs)
      continue

    boundaries.push({
      id: `boundary-${current.timestampMs}`,
      timestampMs: current.timestampMs,
      distance,
      source: 'auto',
    })
    previousBoundaryMs = current.timestampMs
  }

  return boundaries
}

export function buildSlideData(
  boundaries: SlideBoundary[],
  durationMs: number,
  existingSlides: SlideData[] = [],
): SlideData[] {
  const starts = [0, ...boundaries.map((boundary) => boundary.timestampMs)]
  return starts.map((startMs, index) => {
    const endMs = index < starts.length - 1 ? starts[index + 1] : durationMs
    const boundary = index > 0 ? boundaries[index - 1] : undefined
    return {
      id: `slide-${index + 1}`,
      index,
      startMs,
      endMs: Math.max(startMs, endMs),
      detection: {
        source: boundary?.source ?? 'auto',
        distance: boundary?.distance,
      },
      image: existingSlides[index]?.image ?? {},
    }
  })
}

function representativeTimestamp(startMs: number, endMs: number) {
  const segmentDurationMs = Math.max(0, endMs - startMs)
  if (segmentDurationMs <= 400) return startMs
  return startMs + Math.min(Math.round(segmentDurationMs / 2), segmentDurationMs - 200)
}

async function addRepresentativeFrames(
  project: MediaProject,
  slides: SlideData[],
  onProgress?: (progress: number) => void,
) {
  const source = getActiveMediaSource(project)
  const completed: SlideData[] = []
  // Keep ffmpeg sidecars sequential so long videos do not spawn dozens of encoders at once.
  for (let index = 0; index < slides.length; index += 1) {
    const slide = slides[index]
    try {
      const outputPath = await getSlideAssetPath(project.id, index)
      await extractRepresentativeFrame({
        path: source.path,
        crop: project.crop,
        perspectiveCrop: project.perspectiveCrop,
        metadata: source.metadata,
        timestampMs: representativeTimestamp(slide.startMs, slide.endMs),
        outputPath,
      })
      completed.push({ ...slide, image: { representativeFramePath: outputPath } })
    } catch (error) {
      console.error(`Slide ${index + 1}の代表フレームを作成できませんでした`, error)
      completed.push(slide)
    } finally {
      onProgress?.((index + 1) / Math.max(slides.length, 1))
    }
  }

  return completed
}

type RunSlideDetectionInput = {
  project: MediaProject
  threshold?: number
  sampleIntervalMs?: number
  onProgress?: (progress: number) => void
  onStage?: (stage: SlideDetectionStage) => void
}

export async function runSlideDetection({
  project,
  threshold: thresholdOverride,
  sampleIntervalMs: sampleIntervalOverride,
  onProgress,
  onStage,
}: RunSlideDetectionInput): Promise<SlideDetectionOutput> {
  const source = getActiveMediaSource(project)
  const { sampleIntervalMs: configuredSampleIntervalMs, threshold: configuredThreshold } =
    project.settings.slideDetection
  const sampleIntervalMs = sampleIntervalOverride ?? configuredSampleIntervalMs
  const threshold = thresholdOverride ?? configuredThreshold
  onStage?.('sampling')
  const frames = await sampleVideoFrames({
    path: source.path,
    crop: project.crop,
    perspectiveCrop: project.perspectiveCrop,
    metadata: source.metadata,
    sampleIntervalMs,
  })
  onStage?.('comparing')
  const boundaries = detectSlideBoundaries({ frames, threshold })
  onStage?.('extracting')
  const slides = await addRepresentativeFrames(
    project,
    buildSlideData(boundaries, source.metadata.durationMs),
    onProgress,
  )

  return {
    result: {
      sampleIntervalMs,
      threshold,
      framesAnalyzed: frames.length,
      boundaries,
      detectedAt: new Date().toISOString(),
    },
    slides,
  }
}
