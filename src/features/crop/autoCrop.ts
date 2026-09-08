import { join } from '@tauri-apps/api/path'
import { extractCropDetectionFrame } from '../../lib/media/ffmpeg'
import {
  detectVisionRectangles,
  type VisionPoint,
  type VisionRegion,
  type VisionRectangleDetection,
} from '../../lib/ocr/rectangles'
import {
  prepareCropDetectionDirectory,
  removeCropDetectionDirectory,
} from '../../lib/storage/projectAssets'
import type { CropRegion, MediaMetadata } from '../../types/project'
import { normalizedToPixelCrop } from './utils'

export const AUTO_CROP_SAMPLE_COUNT = 12

export type AutoCropProgress = {
  phase: 'extracting' | 'analyzing'
  completed: number
  total: number
}

export type AutoCropResult = {
  crop: CropRegion
  confidence: number
  framesAnalyzed: number
  stableFrames: number
  engineVersion: string
}

type NormalizedRegion = {
  x: number
  y: number
  width: number
  height: number
}

type Candidate = {
  frameIndex: number
  region: NormalizedRegion
  score: number
}

type CandidateCluster = Candidate[]

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(Math.max(value, minimum), maximum)
}

function sampleTimes(durationMs: number, sampleCount: number) {
  const duration = Math.max(0, durationMs)
  if (duration === 0 || sampleCount <= 1) return [0]

  // Avoid intro/outro title cards when possible, while still covering short videos.
  const margin = Math.min(5000, duration * 0.05)
  const start = Math.min(margin, duration / 2)
  const end = Math.max(start, duration - margin)

  return Array.from({ length: sampleCount }, (_, index) => {
    const ratio = index / Math.max(sampleCount - 1, 1)
    return Math.round(start + (end - start) * ratio)
  })
}

function regionFromPolygon(polygon: VisionPoint[]): NormalizedRegion | null {
  if (polygon.length < 4) return null

  const xs = polygon.map((point) => point.x)
  const ys = polygon.map((point) => point.y)
  const left = clamp(Math.min(...xs))
  const top = clamp(Math.min(...ys))
  const right = clamp(Math.max(...xs))
  const bottom = clamp(Math.max(...ys))
  const width = right - left
  const height = bottom - top

  if (width <= 0 || height <= 0) return null
  return { x: left, y: top, width, height }
}

function area(region: NormalizedRegion) {
  return region.width * region.height
}

function center(region: NormalizedRegion) {
  return {
    x: region.x + region.width / 2,
    y: region.y + region.height / 2,
  }
}

function contains(region: NormalizedRegion, point: VisionPoint) {
  return (
    point.x >= region.x &&
    point.x <= region.x + region.width &&
    point.y >= region.y &&
    point.y <= region.y + region.height
  )
}

function centerOfRegion(observation: VisionRegion): VisionPoint | null {
  const region = regionFromPolygon(observation.polygon)
  return region ? center(region) : null
}

function intersectionOverUnion(first: NormalizedRegion, second: NormalizedRegion) {
  const left = Math.max(first.x, second.x)
  const top = Math.max(first.y, second.y)
  const right = Math.min(first.x + first.width, second.x + second.width)
  const bottom = Math.min(first.y + first.height, second.y + second.height)
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top)
  const union = area(first) + area(second) - intersection
  return union <= 0 ? 0 : intersection / union
}

function aspectScore(region: NormalizedRegion) {
  const shortLongRatio =
    Math.min(region.width, region.height) / Math.max(region.width, region.height)
  // Landscape 16:9 and 4:3 slides are the most common cases.
  return clamp(1 - Math.abs(shortLongRatio - 0.64) / 0.36)
}

function areaScore(region: NormalizedRegion) {
  const regionArea = area(region)
  if (regionArea < 0.08) return 0
  if (regionArea >= 0.78) return 1
  return clamp((regionArea - 0.08) / 0.7)
}

function scoreCandidate(
  region: NormalizedRegion,
  observation: VisionRegion,
  textRegions: VisionRegion[],
  faceRegions: VisionRegion[],
) {
  const textCenters = textRegions
    .map(centerOfRegion)
    .filter((point): point is VisionPoint => point !== null)
  const faceCenters = faceRegions
    .map(centerOfRegion)
    .filter((point): point is VisionPoint => point !== null)
  const textScore = clamp(textCenters.filter((point) => contains(region, point)).length / 8)
  const facePenalty = clamp(faceCenters.filter((point) => contains(region, point)).length / 2)

  return clamp(
    observation.confidence * 0.5 +
      aspectScore(region) * 0.2 +
      areaScore(region) * 0.15 +
      textScore * 0.15 -
      facePenalty * 0.1,
  )
}

function clusterCandidates(candidates: Candidate[]) {
  const clusters: CandidateCluster[] = []

  for (const candidate of candidates.sort((first, second) => second.score - first.score)) {
    const matchingCluster = clusters.find((cluster) =>
      cluster.some((member) => intersectionOverUnion(candidate.region, member.region) >= 0.55),
    )
    if (matchingCluster) matchingCluster.push(candidate)
    else clusters.push([candidate])
  }

  return clusters
}

function weightedMeanRegion(cluster: CandidateCluster): NormalizedRegion {
  const totalWeight = cluster.reduce((sum, candidate) => sum + Math.max(candidate.score, 0.05), 0)
  const bounds = cluster.reduce(
    (result, candidate) => {
      const weight = Math.max(candidate.score, 0.05)
      result.left += candidate.region.x * weight
      result.top += candidate.region.y * weight
      result.right += (candidate.region.x + candidate.region.width) * weight
      result.bottom += (candidate.region.y + candidate.region.height) * weight
      return result
    },
    { left: 0, top: 0, right: 0, bottom: 0 },
  )

  const left = clamp(bounds.left / totalWeight)
  const top = clamp(bounds.top / totalWeight)
  const right = clamp(bounds.right / totalWeight)
  const bottom = clamp(bounds.bottom / totalWeight)
  return { x: left, y: top, width: right - left, height: bottom - top }
}

function paddedRegion(region: NormalizedRegion, padding = 0.01): NormalizedRegion {
  const left = clamp(region.x - padding)
  const top = clamp(region.y - padding)
  const right = clamp(region.x + region.width + padding)
  const bottom = clamp(region.y + region.height + padding)
  return { x: left, y: top, width: right - left, height: bottom - top }
}

function candidatesFromDetection(
  detection: VisionRectangleDetection,
  frameIndex: number,
): Candidate[] {
  return detection.rectangles.flatMap((observation) => {
    const region = regionFromPolygon(observation.polygon)
    if (!region || region.width < 0.2 || region.height < 0.1 || area(region) < 0.08) return []

    return [
      {
        frameIndex,
        region,
        score: scoreCandidate(region, observation, detection.textRegions, detection.faceRegions),
      },
    ]
  })
}

function selectStableCluster(
  detections: VisionRectangleDetection[],
  candidates: Candidate[],
): { cluster: CandidateCluster; confidence: number } | null {
  const clusters = clusterCandidates(candidates)
  const minimumStableFrames = Math.max(3, Math.ceil(detections.length * 0.25))
  let best: { cluster: CandidateCluster; confidence: number } | null = null

  for (const cluster of clusters) {
    const stableFrames = new Set(cluster.map((candidate) => candidate.frameIndex)).size
    if (stableFrames < minimumStableFrames) continue

    const meanScore = cluster.reduce((sum, candidate) => sum + candidate.score, 0) / cluster.length
    const coverage = stableFrames / Math.max(detections.length, 1)
    const confidence = clamp(coverage * 0.65 + meanScore * 0.35)
    if (!best || confidence > best.confidence) best = { cluster, confidence }
  }

  return best
}

export async function detectAutomaticCrop({
  projectId,
  path,
  metadata,
  signal,
  onProgress,
}: {
  projectId: string
  path: string
  metadata: MediaMetadata
  signal?: AbortSignal
  onProgress?: (progress: AutoCropProgress) => void
}): Promise<AutoCropResult | null> {
  const times = sampleTimes(metadata.durationMs, AUTO_CROP_SAMPLE_COUNT)
  const directory = await prepareCropDetectionDirectory(projectId)
  const framePaths: string[] = []

  try {
    for (let index = 0; index < times.length; index += 1) {
      const outputPath = await join(directory, `frame-${String(index + 1).padStart(3, '0')}.jpg`)
      await extractCropDetectionFrame({
        path,
        timestampMs: times[index],
        outputPath,
        signal,
      })
      framePaths.push(outputPath)
      onProgress?.({ phase: 'extracting', completed: index + 1, total: times.length })
    }

    onProgress?.({ phase: 'analyzing', completed: 0, total: framePaths.length })
    const detections = await detectVisionRectangles(framePaths, signal)
    onProgress?.({ phase: 'analyzing', completed: framePaths.length, total: framePaths.length })

    const candidates = detections.flatMap((detection, frameIndex) =>
      candidatesFromDetection(detection, frameIndex),
    )
    const selected = selectStableCluster(detections, candidates)
    if (!selected || selected.confidence < 0.42) return null

    const region = paddedRegion(weightedMeanRegion(selected.cluster))
    return {
      crop: normalizedToPixelCrop(region, metadata),
      confidence: selected.confidence,
      framesAnalyzed: detections.length,
      stableFrames: new Set(selected.cluster.map((candidate) => candidate.frameIndex)).size,
      engineVersion: detections[0]?.engineVersion ?? 'apple-vision-rectangles',
    }
  } finally {
    await removeCropDetectionDirectory(projectId).catch(() => undefined)
  }
}
