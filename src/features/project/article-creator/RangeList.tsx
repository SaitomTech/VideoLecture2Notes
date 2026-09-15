import { PencilLine, Plus, Trash2 } from 'lucide-react'
import { formatPlaybackTime, parseTime, rangeColor } from './rangeDraft'
import { VideoThumbnail } from '../components/VideoThumbnail'
import type { ProjectVideo } from '../../../types/project'
import type { ArticleRangeEditor } from './useArticleRangeEditor'

export function RangeList({ video, editor }: { video: ProjectVideo; editor: ArticleRangeEditor }) {
  const {
    duration,
    rows,
    draft,
    editingIndex,
    editingTitleIndex,
    titleInputRef,
    updateInlineTitle,
    beginTitleEdit,
    handleTitleKeyDown,
    setComposingTitle,
    setLastTitleCompositionEnd,
    handleTitleBlur,
    editRange,
    removeRange,
    addRange,
  } = editor

  if (rows.length === 0) return null

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">記事にする区間（{rows.length}件）</p>
        <button
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border border-[#b7cbc0] px-3 text-xs font-semibold text-[#1d6b50] hover:bg-[#e8f2ec]"
          type="button"
          onClick={addRange}
        >
          <Plus size={14} />
          区間を追加
        </button>
      </div>
      <div className="mt-2 space-y-1.5">
        {rows.map((row, index) => {
          const rowColor = rangeColor(index)
          const rowStart = parseTime(row.start, 0)
          const rowEnd = parseTime(row.end, duration)
          const safeStart = Number.isFinite(rowStart) ? Math.max(0, rowStart) : 0
          const safeEnd = Number.isFinite(rowEnd) ? Math.min(duration, rowEnd) : duration
          const left = duration ? (safeStart / duration) * 100 : 0
          const width = duration ? Math.max(0, ((safeEnd - safeStart) / duration) * 100) : 100
          return (
            <div
              className="grid cursor-pointer grid-cols-[30px_96px_minmax(220px,1fr)_auto] items-center gap-2 rounded-[9px] border px-3 py-2.5 transition hover:border-[#9fc3b0] hover:bg-[#fbfdfb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30"
              style={{
                borderColor: editingIndex === index ? `${rowColor.border}66` : '#d8e1dc',
                backgroundColor: editingIndex === index ? `${rowColor.soft}99` : '#fff',
              }}
              key={row.id}
              role="button"
              tabIndex={0}
              aria-label={`${index + 1}件目の区間を編集`}
              onClick={() => editRange(index)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  editRange(index)
                }
              }}
            >
              <span className="font-mono text-sm font-semibold" style={{ color: '#71807b' }}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="-ml-1">
                <VideoThumbnail
                  video={video}
                  thumbnailPath={row.thumbnailPath}
                  thumbnailVersion={row.thumbnailVersion}
                />
              </div>
              <div className="min-w-0 pl-2">
                <div className="flex min-h-7 items-center">
                  {editingTitleIndex === index ? (
                    <input
                      ref={titleInputRef}
                      className="h-7 min-w-0 flex-1 rounded-[6px] border border-[#1d6b50] bg-white px-2 text-xs font-semibold outline-none ring-2 ring-[#1d6b50]/10"
                      placeholder="タイトル"
                      value={draft.title}
                      aria-label={`${index + 1}件目のタイトル`}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => updateInlineTitle(index, event.target.value)}
                      onKeyDown={(event) => handleTitleKeyDown(event, index)}
                      onCompositionStart={() => setComposingTitle(true)}
                      onCompositionEnd={() => {
                        setComposingTitle(false)
                        setLastTitleCompositionEnd()
                      }}
                      onBlur={() => handleTitleBlur(index)}
                    />
                  ) : (
                    <button
                      className="group flex min-w-0 max-w-full items-center rounded-[6px] px-1 text-left text-xs font-semibold leading-7 transition hover:bg-[#eef3ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/20"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        beginTitleEdit(index)
                      }}
                      aria-label={`${row.title}を編集`}
                    >
                      <span className="truncate">{row.title}</span>
                      <PencilLine
                        aria-hidden="true"
                        className="pointer-events-none inline-block size-0 shrink-0 translate-x-[-0.25rem] overflow-hidden text-[#71807b] opacity-0 transition-[width,height,opacity,transform,margin] duration-200 group-hover:ml-1.5 group-hover:size-3.5 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:ml-1.5 group-focus-visible:size-3.5 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
                        strokeWidth={2}
                      />
                    </button>
                  )}
                </div>
                <div className="relative mt-2 h-9 min-w-0">
                  <span
                    className="absolute top-0 translate-x-0 font-mono text-[8px] leading-none"
                    style={{ left: `${left}%`, color: rowColor.text }}
                    aria-hidden="true"
                  >
                    {formatPlaybackTime(safeStart)}
                  </span>
                  <span
                    className="absolute top-0 -translate-x-full font-mono text-[8px] leading-none"
                    style={{ left: `${left + width}%`, color: rowColor.text }}
                    aria-hidden="true"
                  >
                    {formatPlaybackTime(safeEnd)}
                  </span>
                  <span className="absolute left-0 right-0 top-3 h-2 rounded-full bg-[#e5ebe8]" />
                  <span
                    className="absolute top-3 h-2 rounded-full"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: rowColor.bar,
                      boxShadow: `inset 0 0 0 1px ${rowColor.border}99`,
                    }}
                  />
                  <span className="absolute bottom-0 left-0 font-mono text-[8px] text-[#9aa6a1]">
                    0:00
                  </span>
                  <span className="absolute bottom-0 right-0 font-mono text-[8px] text-[#9aa6a1]">
                    {formatPlaybackTime(duration)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-end">
                <button
                  className="rounded-md p-1 text-[#9aa6a1] hover:bg-[#f8ebe7] hover:text-[#b6533a] disabled:cursor-not-allowed disabled:opacity-35"
                  type="button"
                  disabled={rows.length <= 1}
                  onClick={(event) => {
                    event.stopPropagation()
                    removeRange(index)
                  }}
                  aria-label={`${index + 1}件目を削除`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
