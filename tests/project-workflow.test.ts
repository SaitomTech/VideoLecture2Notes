import { expect, test } from 'bun:test'
import { parseMediaProject } from '../src/schemas/project'
import {
  createEmptyProject,
  markProjectOpened,
  markProjectExported,
  syncActiveArticle,
  toPersistedProject,
  updateProjectArticleDraft,
  updateProjectSlideContent,
  updateProjectSlideDetection,
  updateProjectSlideOcr,
  updateProjectTranscription,
  updateProjectWorkflow,
} from '../src/lib/project/project'
import { normalizeTrimRange, isFullTrimRange } from '../src/lib/project/videoRange'
import {
  canNavigateToWorkflowStep,
  getFurthestWorkflowStep,
  isWorkflowStepReached,
} from '../src/lib/workflow'
import type { Article, ProjectVideo, SlideData } from '../src/types/project'
import { PROJECT_VERSION } from '../src/types/project'

const NOW = '2026-09-15T00:00:00.000Z'

function createArticleWorkspace() {
  const base = createEmptyProject('workflow')
  const videoId = 'video-1'
  const articleId = 'article-1'
  const sourcePath = '/tmp/lecture.mp4'
  const videoMedia = {
    path: sourcePath,
    name: 'lecture.mp4',
    extension: 'mp4' as const,
    metadata: { path: sourcePath, durationMs: 10_000, width: 1_920, height: 1_080 },
    origin: { kind: 'local-file' as const },
    ownership: 'managed' as const,
    managedRelativePath: `videos/${videoId}/original.mp4`,
    thumbnailPath: '/tmp/lecture.jpg',
  }
  const video: ProjectVideo = {
    id: videoId,
    title: 'lecture',
    media: videoMedia,
    createdAt: NOW,
    updatedAt: NOW,
  }
  const inputMedia = {
    ...videoMedia,
    managedRelativePath: `articles/${articleId}/input/original.mp4`,
    preparedFromVideoId: videoId,
    preparation: 'copy' as const,
    preparedAt: NOW,
  }
  const slide: SlideData = {
    id: 'slide-1',
    index: 0,
    startMs: 0,
    endMs: 10_000,
    detection: { source: 'auto' },
    image: { representativeFramePath: '/tmp/slide.jpg' },
    ocr: { rawText: 'OCR', model: 'ocr-model', inputFingerprint: 'ocr-fingerprint' },
    transcript: {
      raw: 'transcript',
      model: 'transcription-model',
      articleBody: 'body',
      articleModel: 'article-model',
      articleInputFingerprint: 'article-fingerprint',
    },
  }
  const article: Article = {
    id: articleId,
    title: 'article',
    sourceVideoId: videoId,
    inputMedia,
    sourceRange: { startMs: 0, endMs: 10_000 },
    settings: base.settings,
    slides: [slide],
    slideDetection: {
      sampleIntervalMs: 500,
      threshold: 12,
      framesAnalyzed: 20,
      boundaries: [],
      detectedAt: NOW,
    },
    transcription: {
      model: 'transcription-model',
      provider: 'local',
      audioPath: '/tmp/audio.wav',
      segments: [],
      transcribedAt: NOW,
      inputFingerprint: 'transcription-fingerprint',
    },
    article: { title: 'article' },
    workflow: {
      lastVisitedStep: 'article-review',
      maxReachedStep: 'article-review',
      lastOpenedAt: NOW,
    },
    createdAt: NOW,
    updatedAt: NOW,
  }
  return {
    ...base,
    videos: [video],
    articles: [article],
    activeArticleId: articleId,
    source: inputMedia,
    slides: [slide],
    slideDetection: article.slideDetection,
    transcription: article.transcription,
    article: article.article,
    workflow: article.workflow,
  }
}

test('workflow keeps a previously reached step available after navigating back', () => {
  const initial = createEmptyProject('workflow')
  const completed = updateProjectWorkflow(initial, 'export')
  const revisited = markProjectOpened(completed, 'generate-notes')

  expect(revisited.workflow.lastVisitedStep).toBe('generate-notes')
  expect(revisited.workflow.maxReachedStep).toBe('export')
  expect(isWorkflowStepReached(revisited.workflow.maxReachedStep, 'export')).toBe(true)
})

test('workflow progress never moves backwards when continuing from an earlier step', () => {
  const completed = updateProjectWorkflow(createEmptyProject('workflow'), 'export')
  const continued = updateProjectWorkflow(completed, 'generate-notes')

  expect(continued.workflow.lastVisitedStep).toBe('generate-notes')
  expect(continued.workflow.maxReachedStep).toBe('export')
  expect(getFurthestWorkflowStep('article-review', 'generate-notes')).toBe('article-review')
  expect(canNavigateToWorkflowStep('export', 'generate-notes')).toBe(true)
  expect(canNavigateToWorkflowStep('generate-notes', 'export')).toBe(false)
})

test('export completion records reachability separately from the last visited step', () => {
  const exported = markProjectExported(createArticleWorkspace())
  const revisited = markProjectOpened(exported, 'generate-notes')

  expect(exported.workflow.maxReachedStep).toBe('export')
  expect(exported.workflow.lastVisitedStep).toBe('export')
  expect(exported.workflow.lastExportedAt).toBeTruthy()
  expect(revisited.workflow.maxReachedStep).toBe('export')
  expect(revisited.workflow.lastVisitedStep).toBe('generate-notes')
})

test('persisted workflow restores both the last visited and furthest reached steps', () => {
  const exported = markProjectExported(createArticleWorkspace())
  const revisited = markProjectOpened(exported, 'generate-notes')
  const restored = parseMediaProject(toPersistedProject(syncActiveArticle(revisited)))

  expect(restored.workflow.lastVisitedStep).toBe('generate-notes')
  expect(restored.workflow.maxReachedStep).toBe('export')
})

test('same OCR output is a no-op, while changed OCR invalidates generated notes', () => {
  const exported = markProjectExported(createArticleWorkspace())
  const savedOcr = exported.slides[0].ocr
  if (!savedOcr) throw new Error('テスト用OCRがありません。')

  const same = updateProjectSlideOcr(exported, 'slide-1', savedOcr)
  expect(same).toBe(exported)
  expect(same.slides[0].transcript?.articleBody).toBe('body')

  const changed = updateProjectSlideOcr(exported, 'slide-1', {
    ...savedOcr,
    rawText: 'changed OCR',
  })
  expect(changed.workflow.maxReachedStep).toBe('generate-notes')
  expect(changed.workflow.lastVisitedStep).toBe('generate-notes')
  expect(changed.slides[0].transcript?.articleBody).toBeUndefined()
  expect(canNavigateToWorkflowStep(changed.workflow.maxReachedStep, 'article-review')).toBe(false)
  expect(canNavigateToWorkflowStep(changed.workflow.maxReachedStep, 'export')).toBe(false)
})

test('changed transcription invalidates downstream notes and result', () => {
  const exported = markProjectExported(createArticleWorkspace())
  const transcription = exported.transcription
  if (!transcription) throw new Error('テスト用文字起こし結果がありません。')

  const same = updateProjectTranscription(exported, transcription)
  expect(same).toBe(exported)

  const changed = updateProjectTranscription(exported, {
    ...transcription,
    inputFingerprint: 'transcription-fingerprint-v2',
  })
  expect(changed.workflow.maxReachedStep).toBe('generate-notes')
  expect(changed.workflow.lastVisitedStep).toBe('generate-notes')
  expect(canNavigateToWorkflowStep(changed.workflow.maxReachedStep, 'export')).toBe(false)
})

test('unchanged article drafts do not invalidate the export, but edits do', () => {
  const exported = markProjectExported(createArticleWorkspace())
  const same = updateProjectArticleDraft(exported, {
    title: 'article',
    bodies: { 'slide-1': 'body' },
  })
  expect(same).toBe(exported)

  const changed = updateProjectArticleDraft(exported, {
    title: 'article',
    bodies: { 'slide-1': 'edited body' },
  })
  expect(changed.workflow.maxReachedStep).toBe('export')
  expect(changed.workflow.lastVisitedStep).toBe('article-review')
  expect(changed.slides[0].transcript?.articleBody).toBe('edited body')
})

test('changed slide detection invalidates downstream steps', () => {
  const exported = markProjectExported(createArticleWorkspace())
  const detection = exported.slideDetection
  if (!detection) throw new Error('テスト用スライド検出結果がありません。')

  const changed = updateProjectSlideDetection(
    exported,
    { ...detection, threshold: detection.threshold + 1 },
    exported.slides,
  )
  expect(changed.workflow.maxReachedStep).toBe('generate-notes')
  expect(changed.workflow.lastVisitedStep).toBe('detect-slides')
})

test('changed article generation invalidates the result step', () => {
  const exported = markProjectExported(createArticleWorkspace())
  const changed = updateProjectSlideContent(exported, 'slide-1', {
    article: {
      body: 'regenerated body',
      model: 'article-model-v2',
      inputFingerprint: 'article-fingerprint-v2',
    },
  })

  expect(changed.workflow.maxReachedStep).toBe('article-review')
  expect(changed.workflow.lastVisitedStep).toBe('generate-notes')
  expect(changed.slides[0].transcript?.articleBody).toBe('regenerated body')
  expect(canNavigateToWorkflowStep(changed.workflow.maxReachedStep, 'article-review')).toBe(true)
  expect(canNavigateToWorkflowStep(changed.workflow.maxReachedStep, 'export')).toBe(false)
})

test('range normalization clamps invalid edges and preserves a near-full selection', () => {
  expect(normalizeTrimRange({ startMs: -1_000, endMs: 20_000 }, 10_000)).toEqual({
    startMs: 0,
    endMs: 10_000,
  })
  expect(normalizeTrimRange({ startMs: 9_800, endMs: 9_900 }, 10_000)).toEqual({
    startMs: 9_500,
    endMs: 10_000,
  })
  expect(isFullTrimRange({ startMs: 0, endMs: 9_100 }, 10_000)).toBe(true)
  expect(() => normalizeTrimRange({ startMs: 0, endMs: 1 }, 0)).toThrow()
})

test('project parser accepts the current persisted shape and rejects stale or unknown data', () => {
  const workspace = createArticleWorkspace()
  const persisted = toPersistedProject(workspace)
  expect(parseMediaProject(persisted).version).toBe(PROJECT_VERSION)
  expect(() => parseMediaProject({ ...persisted, version: PROJECT_VERSION - 1 })).toThrow()
  expect(() => parseMediaProject({ ...persisted, unexpected: true })).toThrow()
  expect(() =>
    parseMediaProject({
      ...persisted,
      videos: [
        {
          ...persisted.videos[0],
          media: { ...persisted.videos[0].media, unexpected: true },
        },
      ],
    }),
  ).toThrow()
  expect(() =>
    parseMediaProject({
      ...persisted,
      articles: [
        {
          ...persisted.articles[0],
          sourceRange: { startMs: 5_000, endMs: 5_000 },
        },
      ],
    }),
  ).toThrow()
})
