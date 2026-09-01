import { formatTimestamp } from '../../lib/time'
import type { ExportDocument } from './export'

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }

  return value.replace(/[&<>"']/g, (character) => entities[character])
}

function safeHeading(value: string) {
  return value
    .replace(/[\r\n]/g, ' ')
    .replace(/^#+\s*/, '')
    .trim()
}

function renderBodyHtml(body: string) {
  return body
    .trim()
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}

export function renderHtml(document: ExportDocument) {
  const sections = document.sections
    .map((section) => {
      const body = section.body.trim() ? renderBodyHtml(section.body) : ''
      const slideLabel = `Slide ${String(section.index + 1).padStart(2, '0')}`

      return [
        '      <section class="slide-section">',
        `        <div class="section-meta"><span>${slideLabel}</span><time>${formatTimestamp(section.startMs)} — ${formatTimestamp(section.endMs)}</time></div>`,
        '        <div class="section-content">',
        `          <figure><img src="${section.imagePath}" alt="${slideLabel}の代表画像"></figure>`,
        `          <div class="content">${body}</div>`,
        '        </div>',
        '      </section>',
      ].join('\n')
    })
    .join('\n')

  return [
    '<!doctype html>',
    '<html lang="ja">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>${escapeHtml(document.title)}</title>`,
    '  <style>',
    '    :root { color: #18211f; background: #f4f7f4; font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif; }',
    '    * { box-sizing: border-box; }',
    '    body { margin: 0; }',
    '    main { width: min(100% - 32px, 960px); margin: 0 auto; padding: 64px 0 96px; }',
    '    header { margin-bottom: 48px; }',
    '    h1 { margin: 0; font-size: clamp(28px, 5vw, 48px); letter-spacing: -0.05em; line-height: 1.15; }',
    '    .source { margin: 12px 0 0; color: #71807b; font-size: 14px; }',
    '    .slide-section { padding: 40px 0; border-top: 1px solid #d8e1dc; }',
    '    .section-meta { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 16px; color: #1d6b50; font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }',
    '    .section-content { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 32px; align-items: start; }',
    '    figure { margin: 0; }',
    '    img { display: block; width: 100%; height: auto; border-radius: 8px; }',
    '    .content { min-width: 0; }',
    '    p { margin: 0 0 16px; font-size: 18px; line-height: 1.9; }',
    '    @media (max-width: 600px) { main { padding-top: 36px; } .slide-section { padding: 28px 0; } .section-meta { display: block; } .section-meta time { display: block; margin-top: 4px; } .section-content { grid-template-columns: 1fr; gap: 24px; } p { font-size: 16px; } }',
    '  </style>',
    '</head>',
    '<body>',
    '  <main>',
    '    <header>',
    `      <h1>${escapeHtml(document.title)}</h1>`,
    `      <p class="source">${escapeHtml(document.sourceName)} · ${formatTimestamp(document.durationMs)}</p>`,
    '    </header>',
    sections,
    '  </main>',
    '</body>',
    '</html>',
    '',
  ].join('\n')
}

export function renderMarkdown(document: ExportDocument) {
  const sections = document.sections
    .map((section) => {
      const slideLabel = `Slide ${String(section.index + 1).padStart(2, '0')}`
      const body = section.body.trim() || '（発話なし）'

      return [
        `## ${slideLabel} · ${formatTimestamp(section.startMs)} — ${formatTimestamp(section.endMs)}`,
        '',
        `![${slideLabel}](${section.imagePath})`,
        '',
        body,
      ].join('\n')
    })
    .join('\n\n')

  return [`# ${safeHeading(document.title)}`, '', `元動画: ${document.sourceName}`, '', sections, ''].join('\n')
}

export function renderJson(document: ExportDocument) {
  const portableDocument = {
    title: document.title,
    sourceName: document.sourceName,
    durationMs: document.durationMs,
    sections: document.sections.map(({ sourceImagePath: _sourceImagePath, ...section }) => section),
    transcriptSegments: document.transcriptSegments,
  }

  return `${JSON.stringify(portableDocument, null, 2)}\n`
}

function formatSrtTimestamp(timestampMs: number) {
  const totalMilliseconds = Math.max(0, Math.round(timestampMs))
  const milliseconds = totalMilliseconds % 1000
  const totalSeconds = Math.floor(totalMilliseconds / 1000)
  const seconds = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60
  const hours = Math.floor(totalMinutes / 60)

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`
}

export function renderSrt(document: ExportDocument) {
  const segments = document.transcriptSegments.map((segment, index) =>
    [
      String(index + 1),
      `${formatSrtTimestamp(segment.startMs)} --> ${formatSrtTimestamp(segment.endMs)}`,
      segment.text.trim(),
    ].join('\n'),
  )

  return `${segments.join('\n\n')}\n`
}
