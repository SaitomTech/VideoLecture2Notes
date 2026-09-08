import { formatTimestamp } from '../../lib/time'
import type { ArticleSummary } from '../../types/project'
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

function renderSummaryHtml(summary?: ArticleSummary) {
  if (!summary) return ''

  const keyPoints = summary.keyPoints
    .map((point) => `          <li>${escapeHtml(point)}</li>`)
    .join('\n')
  const keywords = summary.keywords
    .map((keyword) => `          <span>${escapeHtml(keyword)}</span>`)
    .join('\n')

  return [
    '      <section class="article-summary">',
    '        <p class="summary-eyebrow">AI SUMMARY</p>',
    '        <h2>文書全体の要約</h2>',
    `        <div class="summary-overview">${renderBodyHtml(summary.overview)}</div>`,
    '        <div class="summary-group summary-message">',
    '          <h3>中心メッセージ</h3>',
    `          <p>${escapeHtml(summary.mainMessage)}</p>`,
    '        </div>',
    '        <div class="summary-grid">',
    '          <div class="summary-group">',
    '            <h3>主なポイント</h3>',
    '            <ul>',
    keyPoints,
    '            </ul>',
    '          </div>',
    '          <div class="summary-group">',
    '            <h3>キーワード</h3>',
    '            <div class="keywords">',
    keywords,
    '            </div>',
    '          </div>',
    '        </div>',
    '      </section>',
  ]
    .filter(Boolean)
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
    '    .article-summary { margin: 0 0 48px; padding: 28px 32px; border: 1px solid #b7cbc0; border-radius: 12px; background: #eef6f0; }',
    '    .summary-eyebrow { margin: 0 0 4px; color: #1d6b50; font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .08em; }',
    '    .article-summary h2 { margin: 0; font-size: 26px; letter-spacing: -0.04em; }',
    '    .summary-overview { margin-top: 16px; }',
    '    .summary-overview p { margin: 0 0 12px; font-size: 17px; line-height: 1.8; }',
    '    .summary-message { margin-top: 24px; padding: 16px 20px; background: #f4f8f4; }',
    '    .summary-message p { margin: 0; font-size: 16px; line-height: 1.8; }',
    '    .summary-grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 32px; margin-top: 24px; padding-top: 20px; border-top: 1px solid #d8e1dc; }',
    '    .summary-group h3 { margin: 0 0 12px; color: #71807b; font-size: 12px; letter-spacing: .03em; }',
    '    .summary-group ul { margin: 0; padding-left: 20px; }',
    '    .summary-group li { margin: 0 0 8px; font-size: 15px; line-height: 1.7; }',
    '    .keywords { display: flex; flex-wrap: wrap; gap: 8px; }',
    '    .keywords span { padding: 5px 10px; border: 1px solid #b7cbc0; border-radius: 999px; color: #53615b; background: #f4f8f4; font-size: 13px; }',
    '    .slide-section { padding: 40px 0; border-top: 1px solid #d8e1dc; }',
    '    .section-meta { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 16px; color: #1d6b50; font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }',
    '    .section-content { display: grid; grid-template-columns: minmax(0, 2.5fr) minmax(0, 1.5fr); gap: 32px; align-items: start; }',
    '    figure { margin: 0; }',
    '    img { display: block; width: 100%; height: auto; border-radius: 8px; }',
    '    .content { min-width: 0; }',
    '    .section-content.content-below { display: block; }',
    '    .section-content.content-below figure { width: calc(62.5% - 20px); margin: 0 0 24px; }',
    '    p { margin: 0 0 16px; font-size: 16px; line-height: 1.9; }',
    '    @media (max-width: 600px) { main { padding-top: 36px; } .article-summary { padding: 22px 20px; } .summary-grid { grid-template-columns: 1fr; gap: 24px; } .slide-section { padding: 28px 0; } .section-meta { display: block; } .section-meta time { display: block; margin-top: 4px; } .section-content { display: block; } figure, .section-content.content-below figure { width: auto; margin: 0 0 24px; } p { font-size: 14px; } }',
    '  </style>',
    '</head>',
    '<body>',
    '  <main>',
    '    <header>',
    `      <h1>${escapeHtml(document.title)}</h1>`,
    `      <p class="source">${escapeHtml(document.sourceName)} · ${formatTimestamp(document.durationMs)}</p>`,
    '    </header>',
    renderSummaryHtml(document.summary),
    sections,
    '  </main>',
    '  <script>',
    '    (() => {',
    '      const updateSectionLayout = () => {',
    '        const sections = document.querySelectorAll(".section-content")',
    '        if (window.matchMedia("(max-width: 600px)").matches) {',
    '          sections.forEach((section) => section.classList.remove("content-below"))',
    '          return',
    '        }',
    '        sections.forEach((section) => {',
    '          const figure = section.querySelector("figure")',
    '          const content = section.querySelector(".content")',
    '          if (!figure || !content) return',
    '          section.classList.toggle("content-below", content.scrollHeight > figure.getBoundingClientRect().height + 1)',
    '        })',
    '      }',
    '      const updateWhenReady = () => {',
    '        updateSectionLayout()',
    '        document.querySelectorAll(".section-content img").forEach((image) => image.addEventListener("load", updateSectionLayout, { once: true }))',
    '      }',
    '      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", updateWhenReady, { once: true })',
    '      else updateWhenReady()',
    '      window.addEventListener("resize", updateSectionLayout)',
    '    })()',
    '  </script>',
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

  const summary = document.summary
    ? [
        '## 要約',
        '',
        document.summary.overview,
        '',
        '### 主なポイント',
        '',
        ...document.summary.keyPoints.map((point) => `- ${point}`),
        '',
        '### キーワード',
        '',
        document.summary.keywords.map((keyword) => `\`${keyword}\``).join(' · '),
      ].join('\n')
    : ''

  return [
    `# ${safeHeading(document.title)}`,
    '',
    `元動画: ${document.sourceName}`,
    ...(summary ? ['', summary] : []),
    '',
    sections,
    '',
  ].join('\n')
}

export function renderTxt(document: ExportDocument) {
  const sections = document.sections
    .map((section) => {
      const slideLabel = `Slide ${String(section.index + 1).padStart(2, '0')}`
      const body = section.body.trim() || '（発話なし）'

      return [
        `${slideLabel} | ${formatTimestamp(section.startMs)} — ${formatTimestamp(section.endMs)}`,
        '',
        body,
      ].join('\n')
    })
    .join('\n\n------------------------------\n\n')

  const summary = document.summary
    ? [
        '要約',
        '====',
        document.summary.overview,
        '',
        '中心メッセージ',
        document.summary.mainMessage,
        '',
        '主なポイント',
        ...document.summary.keyPoints.map((point) => `・${point}`),
        '',
        'キーワード',
        document.summary.keywords.map((keyword) => `・${keyword}`).join('\n'),
      ].join('\n')
    : ''

  return [document.title, `元動画: ${document.sourceName}`, ...(summary ? ['', summary] : []), '', sections, ''].join('\n')
}
