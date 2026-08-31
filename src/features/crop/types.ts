import type { CropRegion } from '../../types/project'

/** Crop coordinates normalized to the displayed video: every value is 0..1. */
export type NormalizedCropRegion = CropRegion

export type CropHandle = 'north-west' | 'north-east' | 'south-west' | 'south-east'
