import type { SlideData } from '../../types/project'

export type TranscriptionContextLanguage = 'auto' | 'ja' | 'en'

export type OpenAiTranscriptionContext = {
  prompt?: string
  keywords?: string[]
}

type TimeRange = {
  startMs: number
  endMs: number
}

export const MAX_TRANSCRIPTION_KEYWORDS = 100
const MAX_KEYWORD_LENGTH = 80
const MAX_PHRASE_TOKENS = 3

const LATIN_TERM_PATTERN = /[A-Za-z][A-Za-z0-9+#._/-]{1,}/gu
const FALLBACK_TOKEN_PATTERN =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]+|[A-Za-z][A-Za-z0-9+#._/-]*/gu
const JAPANESE_ONLY_PATTERN = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u
const HIRAGANA_ONLY_PATTERN = /^[\p{Script=Hiragana}ー]+$/u
const LATIN_TOKEN_PATTERN = /^[A-Za-z][A-Za-z0-9+#._/-]*$/u
const ENGLISH_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'was',
  'we',
  'with',
])
const JAPANESE_STOPWORDS = new Set([
  'これ',
  'それ',
  'あれ',
  'ここ',
  'そこ',
  'ため',
  'こと',
  'もの',
  'よう',
  'はず',
  '場合',
  '今回',
  '次回',
  'する',
  'される',
  'できる',
  'なる',
  'ある',
  'いる',
  'ない',
  '及び',
  'または',
  'そして',
  'しかし',
  'について',
  'における',
  'という',
  'は',
  'が',
  'を',
  'に',
  'へ',
  'と',
  'で',
  'の',
  'も',
  'や',
  'から',
  'まで',
  'より',
])

type CandidateKind = 'token' | 'phrase' | 'technical'

type CandidateStats = {
  value: string
  score: number
  occurrences: number
  slideIds: Set<string>
  kind: CandidateKind
}

type OcrUnit = {
  text: string
  confidence?: number
  top?: number
}

type WordToken = {
  value: string
  start: number
  end: number
  kind: 'ja' | 'en' | 'other'
}

function normalizeOcrText(text: string) {
  return text.normalize('NFKC').replace(/\s+/gu, ' ').trim()
}

function keywordKey(keyword: string) {
  return keyword.normalize('NFKC').replace(/\s+/gu, '').toLowerCase()
}

function cleanKeyword(value: string) {
  return normalizeOcrText(value)
    .replace(/^[-–—•*]+|[-–—•*]+$/gu, '')
    .trim()
}

function classifyToken(value: string): WordToken['kind'] {
  if (JAPANESE_ONLY_PATTERN.test(value)) return 'ja'
  if (LATIN_TOKEN_PATTERN.test(value)) return 'en'
  return 'other'
}

function isContentToken(value: string, kind: WordToken['kind']) {
  const keyword = cleanKeyword(value)
  if (!keyword || keyword.length < 2 || kind === 'other') return false

  if (kind === 'en') {
    if (ENGLISH_STOPWORDS.has(keyword.toLowerCase())) return false
    return keyword.length >= 3 || /\d|[#.+_/-]/u.test(keyword) || keyword === keyword.toUpperCase()
  }

  if (JAPANESE_STOPWORDS.has(keywordKey(keyword))) return false
  if (HIRAGANA_ONLY_PATTERN.test(keyword) && keyword.length < 3) return false
  return true
}

function isTechnicalToken(value: string) {
  return (
    /\d|[#.+_/-]/u.test(value) ||
    (/[A-Z]/u.test(value) && /[a-z]/u.test(value)) ||
    (value.length <= 6 && value === value.toUpperCase())
  )
}

function addCandidate(
  candidates: Map<string, CandidateStats>,
  value: string,
  {
    slideId,
    roleWeight,
    unitIndex,
    unitCount,
    confidence,
    top,
    kind,
  }: {
    slideId: string
    roleWeight: number
    unitIndex: number
    unitCount: number
    confidence?: number
    top?: number
    kind: CandidateKind
  },
) {
  const keyword = cleanKeyword(value)
  if (!keyword || keyword.length < 2 || keyword.length > MAX_KEYWORD_LENGTH) return
  if (!/[\p{Script=Han}\p{Script=Katakana}A-Za-z0-9]/u.test(keyword)) return
  const key = keywordKey(keyword)
  if (!key || (keyword.includes(' ') && keyword.split(/\s+/u).length > MAX_PHRASE_TOKENS)) return

  const positionScore = unitCount <= 1 ? 2 : 2 * (1 - unitIndex / (unitCount - 1))
  const confidenceScore = confidence === undefined ? 0 : Math.max(0, Math.min(1, confidence)) * 2
  const layoutScore = top !== undefined && top <= 0.3 ? 1 : 0
  const kindScore = kind === 'phrase' ? 3 : kind === 'technical' ? 3 : 1.5
  const lengthScore = keyword.length >= 3 && keyword.length <= 24 ? 0.5 : 0
  const stats = candidates.get(key) ?? {
    value: keyword,
    score: 0,
    occurrences: 0,
    slideIds: new Set<string>(),
    kind,
  }
  stats.score +=
    roleWeight * kindScore + positionScore + confidenceScore + layoutScore + lengthScore
  stats.occurrences += 1
  stats.slideIds.add(slideId)
  if (kind === 'phrase' || kind === 'technical') stats.kind = kind
  candidates.set(key, stats)
}

function segmentWords(text: string, language: TranscriptionContextLanguage) {
  if (typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(language === 'en' ? 'en-US' : 'ja-JP', {
      granularity: 'word',
    })
    return [...segmenter.segment(text)]
      .filter((part) => part.isWordLike)
      .map((part) => ({
        value: part.segment,
        start: part.index,
        end: part.index + part.segment.length,
        kind: classifyToken(part.segment),
      }))
  }

  return [...text.matchAll(FALLBACK_TOKEN_PATTERN)].map((match) => ({
    value: match[0],
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    kind: classifyToken(match[0]),
  }))
}

function addPhraseCandidates(
  candidates: Map<string, CandidateStats>,
  text: string,
  tokens: WordToken[],
  context: Omit<Parameters<typeof addCandidate>[2], 'kind'>,
) {
  for (let startIndex = 0; startIndex < tokens.length; startIndex += 1) {
    const first = tokens[startIndex]
    if (first.kind !== 'ja' && first.kind !== 'en') continue
    if (!isContentToken(first.value, first.kind)) continue

    for (
      let endIndex = startIndex + 1;
      endIndex < Math.min(tokens.length, startIndex + MAX_PHRASE_TOKENS);
      endIndex += 1
    ) {
      const previous = tokens[endIndex - 1]
      const current = tokens[endIndex]
      if (current.kind !== first.kind || !isContentToken(current.value, current.kind)) break
      const gap = text.slice(previous.end, current.start)
      const canJoin = first.kind === 'ja' ? gap.length === 0 : /^\s+$/u.test(gap)
      if (!canJoin) break

      addCandidate(candidates, text.slice(first.start, current.end), {
        ...context,
        kind: 'phrase',
      })
    }
  }
}

function slideOcrUnits(slide: SlideData): OcrUnit[] {
  const blocks = slide.ocr?.blocks?.filter((block) => block.text.trim()) ?? []
  if (blocks.length > 0) {
    return blocks.map((block) => ({
      text: block.text,
      confidence: block.confidence,
      top:
        block.polygon && block.polygon.length > 0
          ? Math.min(...block.polygon.map((point) => point.y))
          : undefined,
    }))
  }

  return (slide.ocr?.rawText ?? '')
    .split(/\r?\n/u)
    .map((text) => ({ text }))
    .filter((unit) => unit.text.trim())
}

function extractKeywords(
  contextSlides: Array<{ slide: SlideData; roleWeight: number }>,
  language: TranscriptionContextLanguage,
) {
  const candidates = new Map<string, CandidateStats>()

  for (const { slide, roleWeight } of contextSlides) {
    const units = slideOcrUnits(slide)
    for (let unitIndex = 0; unitIndex < units.length; unitIndex += 1) {
      const unit = units[unitIndex]
      const text = normalizeOcrText(unit.text)
      if (!text) continue
      const context = {
        slideId: slide.id,
        roleWeight,
        unitIndex,
        unitCount: units.length,
        confidence: unit.confidence,
        top: unit.top,
      }
      const tokens = segmentWords(text, language)
      for (const token of tokens) {
        if (isContentToken(token.value, token.kind)) {
          addCandidate(candidates, token.value, {
            ...context,
            kind: isTechnicalToken(token.value) ? 'technical' : 'token',
          })
        }
      }
      for (const match of text.matchAll(LATIN_TERM_PATTERN)) {
        if (isTechnicalToken(match[0])) {
          addCandidate(candidates, match[0], {
            ...context,
            kind: 'technical',
          })
        }
      }
      addPhraseCandidates(candidates, text, tokens, context)
    }
  }

  const rankedCandidates = [...candidates.values()]
    .map((candidate) => ({
      ...candidate,
      score:
        candidate.score +
        Math.min(4, Math.max(0, candidate.slideIds.size - 1)) * 1.5 +
        Math.min(5, Math.max(0, candidate.occurrences - 1)) * 0.35,
    }))
    .sort((first, second) => second.score - first.score || second.value.length - first.value.length)

  const selected: CandidateStats[] = []
  for (const candidate of rankedCandidates) {
    if (selected.length >= MAX_TRANSCRIPTION_KEYWORDS) break
    const candidateKey = keywordKey(candidate.value)
    const isRedundant = selected.some((existing) => {
      const existingKey = keywordKey(existing.value)
      if (candidateKey === existingKey) return true
      if (candidateKey.length < 3 || existingKey.length < 3) return false
      return (
        existing.kind === 'phrase' &&
        existingKey.includes(candidateKey) &&
        existingKey.length > candidateKey.length
      )
    })
    if (!isRedundant) selected.push(candidate)
  }

  return selected.map((candidate) => candidate.value)
}

function slideOverlapsRange(slide: SlideData, range: TimeRange) {
  return slide.endMs > range.startMs && slide.startMs < range.endMs
}

function promptFor(language: TranscriptionContextLanguage, hasKeywords: boolean) {
  if (language === 'auto' || !hasKeywords) return undefined

  if (language === 'en') {
    return 'Lecture transcription. Use the supplied keywords as spelling hints only when they are spoken in the audio.'
  }

  return '講義音声の文字起こしです。指定されたキーワードは、音声に実際に含まれる場合だけ表記の補助に使ってください。'
}

/**
 * Builds bounded, slide-local context plus adjacent slide hints for one transcription chunk.
 * OCR is treated as spelling context, never as text to append to the transcript.
 */
export function buildOpenAiTranscriptionContext(
  slides: SlideData[],
  range: TimeRange,
  language: TranscriptionContextLanguage,
): OpenAiTranscriptionContext {
  const orderedSlides = slides.toSorted((first, second) => first.startMs - second.startMs)
  const overlappingIndexes: number[] = []
  for (let index = 0; index < orderedSlides.length; index += 1) {
    if (slideOverlapsRange(orderedSlides[index], range)) overlappingIndexes.push(index)
  }

  if (overlappingIndexes.length === 0) return {}

  const contextSlideWeights = new Map<number, number>()
  for (const index of overlappingIndexes) {
    contextSlideWeights.set(index, Math.max(contextSlideWeights.get(index) ?? 0, 3))
    if (index > 0) {
      contextSlideWeights.set(index - 1, Math.max(contextSlideWeights.get(index - 1) ?? 0, 1))
    }
    if (index < orderedSlides.length - 1) {
      contextSlideWeights.set(index + 1, Math.max(contextSlideWeights.get(index + 1) ?? 0, 1))
    }
  }

  const contextSlides: Array<{ slide: SlideData; roleWeight: number }> = []
  for (const [index, roleWeight] of contextSlideWeights) {
    const slide = orderedSlides[index]
    if (slide?.ocr?.rawText.trim() || (slide?.ocr?.blocks?.length ?? 0) > 0) {
      contextSlides.push({ slide, roleWeight })
    }
  }
  contextSlides.sort((first, second) => first.slide.startMs - second.slide.startMs)
  const keywords = extractKeywords(contextSlides, language)
  const prompt = promptFor(language, keywords.length > 0)

  return {
    ...(keywords.length > 0 ? { keywords } : {}),
    ...(prompt ? { prompt } : {}),
  }
}
