import { CheckCircle2, ChevronRight, Film, Trash2, X } from 'lucide-react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { useState } from 'react'
import { formatTimestamp } from '../../../lib/time'
import type { Article, MediaProject } from '../../../types/project'

export type CreationNotice = { articleIds: string[]; count: number }

function ArticleThumbnail({ article }: { article: Article }) {
  const [failedPaths, setFailedPaths] = useState<string[]>([])
  const imagePaths = [
    article.inputMedia.thumbnailPath,
    ...article.slides.map((slide) => slide.image.representativeFramePath),
  ].filter((path): path is string => Boolean(path))
  const imagePath = imagePaths.find((path) => !failedPaths.includes(path))
  return (
    <div className="grid h-14 w-24 shrink-0 place-items-center overflow-hidden rounded-[7px] border border-[#d8e1dc] bg-[#e8f2ec]">
      {imagePath ? (
        <img
          className="h-full w-full object-cover"
          src={convertFileSrc(imagePath)}
          alt=""
          loading="lazy"
          onError={() => setFailedPaths((current) => [...new Set([...current, imagePath])])}
        />
      ) : (
        <Film className="text-[#8da79a]" size={20} strokeWidth={1.4} />
      )}
    </div>
  )
}

function articleStatus(article: Article) {
  if (article.workflow.maxReachedStep === 'export') return '完了'
  if (article.workflow.lastVisitedStep === 'detect-slides' && !article.slideDetection)
    return '未着手'
  return '作業途中'
}

function articleActionLabel(article: Article) {
  if (article.workflow.lastVisitedStep === 'export') return '記事を見る'
  if (article.workflow.lastVisitedStep === 'detect-slides' && !article.slideDetection)
    return '作業を開始'
  return '作業を再開'
}

export function ArticleList({
  project,
  creationNotice,
  onDismissNotice,
  onStartArticleCreator,
  onOpenArticle,
  onDeleteArticle,
}: {
  project: MediaProject
  creationNotice: CreationNotice | null
  onDismissNotice: () => void
  onStartArticleCreator: () => void
  onOpenArticle: (articleId: string) => void
  onDeleteArticle: (articleId: string) => void
}) {
  return (
    <section className="mt-0">
      {creationNotice && (
        <div className="mt-4 rounded-[10px] border border-[#b7cbc0] bg-[#f1f8f3] px-4 py-3">
          <div className="flex items-start gap-2.5">
            <CheckCircle2
              className="mt-0.5 shrink-0 text-[#1d6b50]"
              size={17}
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#1d6b50]">記事作成の準備ができました</p>
              <p className="mt-1 text-xs leading-5 text-[#53615b]">
                {creationNotice.count}
                件の区間を追加しました。「作業を開始」から文字起こしを進められます。
              </p>
            </div>
            <button
              className="rounded-md p-1 text-[#8b9892] hover:bg-white hover:text-[#53615b]"
              type="button"
              onClick={onDismissNotice}
              aria-label="記事化案内を閉じる"
            >
              <X size={15} />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 pl-[27px]">
            <button
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#b8d2c5] bg-white px-3 py-2 text-xs font-semibold text-[#1d6b50] hover:bg-[#f4faf6]"
              type="button"
              onClick={() => {
                const firstArticleId = creationNotice.articleIds[0]
                onDismissNotice()
                if (firstArticleId) onOpenArticle(firstArticleId)
              }}
            >
              {creationNotice.count === 1 ? '作業を開始' : '1件目の作業を開始'}
              <ChevronRight size={14} />
            </button>
            <button
              className="rounded-[8px] px-3 py-2 text-xs font-semibold text-[#71807b] hover:bg-white"
              type="button"
              onClick={onDismissNotice}
            >
              あとで見る
            </button>
          </div>
        </div>
      )}
      <div className="mt-4 overflow-hidden">
        {project.articles.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <Film className="text-[#9aada3]" size={32} strokeWidth={1.3} />
            <p className="mt-4 text-sm font-semibold">まだ記事がありません</p>
            <p className="mt-2 text-xs text-[#71807b]">
              元動画を選んで、記事にする区間を指定できます。
            </p>
            <button
              className="mt-5 inline-flex items-center gap-1.5 rounded-[8px] bg-[#1d6b50] px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-[#174d3c]"
              type="button"
              onClick={onStartArticleCreator}
            >
              <ChevronRight size={14} />
              記事作成の準備
            </button>
          </div>
        ) : (
          project.articles.map((article) => (
            <article
              className={`flex flex-wrap items-center gap-4 py-3 pl-3 pr-3 ${creationNotice?.articleIds.includes(article.id) ? 'bg-[#eaf5ee]' : 'border-b border-[#d8e1dc]'}`}
              key={article.id}
              style={{
                boxShadow: creationNotice?.articleIds.includes(article.id)
                  ? 'inset 0 0 0 0.5px #a7cdb8'
                  : undefined,
              }}
            >
              <ArticleThumbnail article={article} />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <h3 className="truncate text-sm font-semibold">{article.title}</h3>
                  <span className="shrink-0 rounded-full bg-[#e8f2ec] px-2 py-0.5 text-[10px] font-semibold text-[#1d6b50]">
                    {articleStatus(article)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#71807b]">
                  {formatTimestamp(article.inputMedia.metadata.durationMs)}
                </p>
              </div>
              <button
                className={`rounded-[8px] px-3 py-2 text-xs font-semibold ${articleActionLabel(article) === '作業を開始' ? 'bg-[#1d6b50] text-white hover:bg-[#174d3c]' : 'border border-[#b7cbc0] bg-white text-[#1d6b50] hover:bg-[#f4faf6]'}`}
                type="button"
                onClick={() => {
                  onDismissNotice()
                  onOpenArticle(article.id)
                }}
              >
                {articleActionLabel(article)}
              </button>
              <button
                className="rounded-[8px] p-2 text-[#9aa6a1] hover:bg-[#f8ebe7] hover:text-[#b6533a]"
                type="button"
                onClick={() => onDeleteArticle(article.id)}
                aria-label={`${article.title}を削除`}
              >
                <Trash2 size={14} />
              </button>
            </article>
          ))
        )}
      </div>
    </section>
  )
}
