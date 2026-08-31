import type { CropRegion, MediaMetadata } from '../../types/project'
import type { NormalizedCropRegion } from './types'

export const FULL_FRAME: NormalizedCropRegion = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

export function pixelToNormalizedCrop(crop: CropRegion, metadata: MediaMetadata): NormalizedCropRegion {
  return {
    x: clamp(crop.x / metadata.width, 0, 1),
    y: clamp(crop.y / metadata.height, 0, 1),
    width: clamp(crop.width / metadata.width, 0, 1),
    height: clamp(crop.height / metadata.height, 0, 1),
  }
}

export function normalizedToPixelCrop(crop: NormalizedCropRegion, metadata: MediaMetadata): CropRegion {
  const x = Math.round(clamp(crop.x, 0, 1) * metadata.width)
  const y = Math.round(clamp(crop.y, 0, 1) * metadata.height)
  const right = Math.round(clamp(crop.x + crop.width, 0, 1) * metadata.width)
  const bottom = Math.round(clamp(crop.y + crop.height, 0, 1) * metadata.height)

  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  }
}
