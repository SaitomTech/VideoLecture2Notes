import { z } from 'zod'
import type { MediaProject } from '../types/project'

const MediaMetadataSchema = z.object({
  path: z.string().min(1),
  durationMs: z.number().finite().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().finite().positive().optional(),
  videoCodec: z.string().min(1).optional(),
  audioCodec: z.string().min(1).optional(),
})

const CropRegionSchema = z.object({
  x: z.number().finite().nonnegative(),
  y: z.number().finite().nonnegative(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
})

const SlideDataSchema = z.object({
  id: z.string().min(1),
  index: z.number().int().nonnegative(),
  startMs: z.number().finite().nonnegative(),
  endMs: z.number().finite().nonnegative(),
  detection: z.object({
    source: z.enum(['auto', 'manual']),
    hash: z.string().optional(),
    distance: z.number().finite().nonnegative().optional(),
  }),
  image: z.object({
    representativeFramePath: z.string().optional(),
  }),
  ocr: z.object({
    rawText: z.string(),
    title: z.string().nullable().optional(),
    terms: z.array(z.string()).optional(),
    model: z.string(),
  }).optional(),
  transcript: z.object({
    raw: z.string(),
    corrected: z.string().optional(),
    articleBody: z.string().optional(),
    model: z.string(),
  }).optional(),
})

export const MediaProjectSchema = z.object({
  version: z.number().int().positive(),
  id: z.string().min(1),
  source: z.object({
    path: z.string().min(1),
    name: z.string().min(1),
    extension: z.enum(['mp4', 'mov', 'm4v', 'mkv', 'webm']),
    sizeBytes: z.number().int().nonnegative().optional(),
    metadata: MediaMetadataSchema,
  }),
  crop: CropRegionSchema,
  settings: z.object({
    slideDetection: z.object({
      sampleIntervalMs: z.number().int().positive(),
      threshold: z.number().finite().nonnegative(),
    }),
    transcription: z.boolean(),
    ocr: z.boolean(),
    correction: z.boolean(),
    articleFormatting: z.boolean(),
  }),
  slides: z.array(SlideDataSchema),
  article: z.unknown().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export function parseMediaProject(value: unknown): MediaProject {
  return MediaProjectSchema.parse(value) as MediaProject
}
