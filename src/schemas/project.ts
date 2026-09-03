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

const SlideBoundarySchema = z.object({
  id: z.string().min(1),
  timestampMs: z.number().int().nonnegative(),
  distance: z.number().finite().nonnegative(),
  source: z.enum(['auto', 'manual']),
})

const SlideDetectionResultSchema = z.object({
  sampleIntervalMs: z.number().int().positive(),
  threshold: z.number().finite().nonnegative(),
  framesAnalyzed: z.number().int().nonnegative(),
  boundaries: z.array(SlideBoundarySchema),
  detectedAt: z.iso.datetime(),
})

const TranscriptSegmentSchema = z.object({
  startMs: z.number().finite().nonnegative(),
  endMs: z.number().finite().nonnegative(),
  text: z.string(),
})

const TranscriptionResultSchema = z.object({
  model: z.string().min(1),
  provider: z.enum(['local', 'openai', 'apple']).optional(),
  engineVersion: z.string().min(1).optional(),
  language: z.string().min(1).optional(),
  audioPath: z.string().min(1),
  segments: z.array(TranscriptSegmentSchema),
  transcribedAt: z.iso.datetime(),
  inputFingerprint: z.string().min(1),
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
  ocr: z
    .object({
      rawText: z.string(),
      model: z.string(),
      provider: z.enum(['local', 'vision', 'openai']).optional(),
      blocks: z
        .array(
          z.object({
            text: z.string(),
            confidence: z.number().finite().min(0).max(1).optional(),
            polygon: z
              .array(
                z.object({
                  x: z.number().finite(),
                  y: z.number().finite(),
                }),
              )
              .optional(),
          }),
        )
        .optional(),
      engineVersion: z.string().min(1).optional(),
      language: z.string().min(1).optional(),
      usage: z
        .object({
          inputTokens: z.number().int().nonnegative(),
          outputTokens: z.number().int().nonnegative(),
        })
        .optional(),
      requestId: z.string().optional(),
      inputFingerprint: z.string().optional(),
    })
    .optional(),
  transcript: z
    .object({
      raw: z.string(),
      articleBody: z.string().optional(),
      articleModel: z.string().optional(),
      articleInputFingerprint: z.string().optional(),
      articleProvider: z.enum(['local', 'openai', 'apple']).optional(),
      articleEngineVersion: z.string().min(1).optional(),
      articleInputTokens: z.number().int().nonnegative().optional(),
      articleOutputTokens: z.number().int().nonnegative().optional(),
      articleRequestId: z.string().optional(),
      articleGeneratedAt: z.iso.datetime().optional(),
      model: z.string(),
    })
    .optional(),
})

const ProjectWorkflowSchema = z.object({
  cropConfirmedAt: z.iso.datetime().optional(),
  lastVisitedStep: z
    .enum(['crop', 'detect-slides', 'generate-notes', 'article-review', 'export'])
    .default('crop'),
  lastOpenedAt: z.iso.datetime().optional(),
  lastExportedAt: z.iso.datetime().optional(),
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
  slideDetection: SlideDetectionResultSchema.optional(),
  transcription: TranscriptionResultSchema.optional(),
  article: z
    .object({
      title: z.string(),
    })
    .optional(),
  workflow: ProjectWorkflowSchema.optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export function parseMediaProject(value: unknown): MediaProject {
  const parsed = MediaProjectSchema.parse(value)
  const workflow = parsed.workflow
  const fallbackStep = parsed.slideDetection ? 'generate-notes' : 'crop'

  return {
    ...parsed,
    workflow: {
      lastVisitedStep: workflow?.lastVisitedStep ?? fallbackStep,
      ...(workflow?.cropConfirmedAt || parsed.slideDetection
        ? { cropConfirmedAt: workflow?.cropConfirmedAt ?? parsed.updatedAt }
        : {}),
      lastOpenedAt: workflow?.lastOpenedAt ?? parsed.updatedAt,
      ...(workflow?.lastExportedAt ? { lastExportedAt: workflow.lastExportedAt } : {}),
    },
    version: Math.max(parsed.version, 2),
  } as MediaProject
}
