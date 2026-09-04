import type {
  SlideData,
  TranscriptAlignment,
  TranscriptPlacement,
  TranscriptSegment,
  TranscriptUnit,
} from '../../types/project'

const SENTENCE_PATTERN = /[^。！？!?]+[。！？!?]?/gu

export function transcriptSegmentId(segment: TranscriptSegment, index: number) {
  return segment.id.trim() || `segment-${index}-${segment.startMs}-${segment.endMs}`
}

export function normalizeTranscriptSegments(segments: TranscriptSegment[]) {
  const occurrences = new Map<string, number>()
  return segments.map((segment, index) => {
    const baseId = transcriptSegmentId(segment, index)
    const occurrence = occurrences.get(baseId) ?? 0
    occurrences.set(baseId, occurrence + 1)
    return {
      ...segment,
      id: occurrence === 0 ? baseId : `${baseId}-${occurrence}`,
      text: segment.text.trim(),
    }
  })
}

/**
 * Creates sentence-sized units when possible. Whisper/Apple timestamps are
 * segment-level, so split sentence timestamps are explicitly marked as
 * estimated rather than pretending to have word-level accuracy.
 */
export function createTranscriptUnits(segments: TranscriptSegment[]): TranscriptUnit[] {
  return normalizeTranscriptSegments(segments).flatMap((segment) => {
    if (!segment.text) return []

    const matches = [...segment.text.matchAll(SENTENCE_PATTERN)]
    const parts = matches.length
      ? matches.map((match) => {
          const raw = match[0]
          const leadingWhitespace = raw.search(/\S/u)
          const start = (match.index ?? 0) + Math.max(0, leadingWhitespace)
          const text = raw.trim()
          return { text, textStart: start, textEnd: start + text.length }
        })
      : [{ text: segment.text, textStart: 0, textEnd: segment.text.length }]

    const duration = Math.max(0, segment.endMs - segment.startMs)
    return parts.map((part, partIndex) => {
      const startRatio = segment.text.length > 0 ? part.textStart / segment.text.length : 0
      const endRatio = segment.text.length > 0 ? part.textEnd / segment.text.length : 1
      const startMs = Math.round(segment.startMs + duration * startRatio)
      const endMs = Math.max(
        startMs,
        partIndex === parts.length - 1
          ? segment.endMs
          : Math.round(segment.startMs + duration * endRatio),
      )

      return {
        id: `${segment.id}:unit-${partIndex}`,
        sourceSegmentId: segment.id,
        startMs,
        endMs,
        text: part.text,
        textStart: part.textStart,
        textEnd: part.textEnd,
        timingQuality: parts.length === 1 ? ('source' as const) : ('estimated' as const),
      }
    })
  })
}

function overlapDuration(
  segment: Pick<TranscriptUnit, 'startMs' | 'endMs'>,
  slide: Pick<SlideData, 'startMs' | 'endMs'>,
) {
  return Math.max(
    0,
    Math.min(segment.endMs, slide.endMs) - Math.max(segment.startMs, slide.startMs),
  )
}

export function slideIndexForTranscriptUnit(unit: TranscriptUnit, slides: SlideData[]) {
  const midpoint = (unit.startMs + unit.endMs) / 2
  const containingIndex = slides.findIndex(
    (slide, index) =>
      midpoint >= slide.startMs && (midpoint < slide.endMs || index === slides.length - 1),
  )
  if (containingIndex >= 0) return containingIndex

  let bestIndex = -1
  let bestOverlap = 0
  slides.forEach((slide, index) => {
    const overlap = overlapDuration(unit, slide)
    if (overlap > bestOverlap) {
      bestIndex = index
      bestOverlap = overlap
    }
  })
  return bestIndex
}

export function createInitialTranscriptPlacements(
  slides: SlideData[],
  units: TranscriptUnit[],
): TranscriptPlacement[] {
  return units.flatMap((unit) => {
    const slideIndex = slideIndexForTranscriptUnit(unit, slides)
    const slide = slides[slideIndex]
    return slide
      ? [
          {
            unitId: unit.id,
            slideId: slide.id,
            method: 'time' as const,
          },
        ]
      : []
  })
}

function alignmentMethodForSlide(slideId: string, placements: TranscriptPlacement[]) {
  const unitIds = new Set(
    placements
      .filter((placement) => placement.slideId === slideId)
      .map((placement) => placement.unitId),
  )
  const methods = placements
    .filter((placement) => unitIds.has(placement.unitId))
    .map((placement) => placement.method)
  if (methods.includes('manual')) return 'manual' as const
  if (methods.includes('semantic')) return 'semantic' as const
  return 'time' as const
}

export function buildSlidesFromTranscript(
  slides: SlideData[],
  units: TranscriptUnit[],
  placements: TranscriptPlacement[],
  model: string,
) {
  const validUnitIds = new Set(units.map((unit) => unit.id))
  const placementByUnitId = new Map(
    placements
      .filter((placement) => validUnitIds.has(placement.unitId))
      .map((placement) => [placement.unitId, placement]),
  )

  const unitsBySlide = new Map<string, TranscriptUnit[]>()
  for (const unit of units) {
    const placement = placementByUnitId.get(unit.id)
    const slide = slides.find((candidate) => candidate.id === placement?.slideId)
    const fallbackSlide = slides[slideIndexForTranscriptUnit(unit, slides)]
    const targetSlide = slide ?? fallbackSlide
    if (!targetSlide) continue
    const assigned = unitsBySlide.get(targetSlide.id) ?? []
    assigned.push(unit)
    unitsBySlide.set(targetSlide.id, assigned)
  }

  return slides.map((slide) => {
    const slideUnits = (unitsBySlide.get(slide.id) ?? []).sort(
      (first, second) => first.startMs - second.startMs,
    )
    return {
      ...slide,
      transcript: {
        raw: slideUnits.map((unit) => unit.text).join(' '),
        segments: slideUnits,
        alignmentMethod: alignmentMethodForSlide(slide.id, placements),
        model,
      },
    }
  })
}

export function assignTranscriptToSlides(
  slides: SlideData[],
  segments: TranscriptSegment[],
  model: string,
  alignment?: Pick<TranscriptAlignment, 'units' | 'placements'>,
) {
  const units = alignment?.units ?? createTranscriptUnits(segments)
  const placements = alignment?.placements ?? createInitialTranscriptPlacements(slides, units)
  return buildSlidesFromTranscript(slides, units, placements, model)
}
