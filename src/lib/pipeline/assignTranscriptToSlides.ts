import type { SlideData, TranscriptSegment } from '../../types/project'

function overlapDuration(
  segment: TranscriptSegment,
  slide: SlideData,
) {
  return Math.max(
    0,
    Math.min(segment.endMs, slide.endMs) - Math.max(segment.startMs, slide.startMs),
  )
}

function slideIndexForSegment(segment: TranscriptSegment, slides: SlideData[]) {
  let bestIndex = -1
  let bestOverlap = 0
  slides.forEach((slide, index) => {
    const overlap = overlapDuration(segment, slide)
    if (overlap > bestOverlap) {
      bestIndex = index
      bestOverlap = overlap
    }
  })
  if (bestIndex >= 0) return bestIndex

  const midpoint = (segment.startMs + segment.endMs) / 2
  return slides.findIndex(
    (slide, index) =>
      midpoint >= slide.startMs &&
      (midpoint < slide.endMs || index === slides.length - 1),
  )
}

export function assignTranscriptToSlides(
  slides: SlideData[],
  segments: TranscriptSegment[],
  model: string,
) {
  const slideSegments = slides.map(() => [] as TranscriptSegment[])

  for (const segment of segments) {
    const text = segment.text.trim()
    if (!text) continue
    const index = slideIndexForSegment(segment, slides)
    if (index >= 0) slideSegments[index].push({ ...segment, text })
  }

  return slides.map((slide, index) => ({
    ...slide,
    transcript: {
      raw: slideSegments[index].map((segment) => segment.text).join(' '),
      model,
    },
  }))
}
