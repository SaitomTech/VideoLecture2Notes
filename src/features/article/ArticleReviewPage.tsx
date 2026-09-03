import { ArrowLeft, ArrowRight, FilePenLine, Save, X } from 'lucide-react'
import { useState } from 'react'
import { AppHeader } from '../../components/AppHeader'
import { WorkflowBar } from '../../components/WorkflowBar'
import type { ArticleDraft, MediaProject } from '../../types/project'
import { ArticleSectionEditor } from './components/ArticleSectionEditor'

type ArticleReviewPageProps = {
  project: MediaProject
  onBack: () => void
  onSave: (draft: ArticleDraft) => void | Promise<void>
  onExport: () => void
  onOpenProjects: () => void
}

export function ArticleReviewPage({ project, onBack, onSave, onExport, onOpenProjects }: ArticleReviewPageProps) {
  const articleSlides = project.slides.filter((slide) => Boolean(slide.transcript))
  const savedTitle = project.article?.title?.trim() || project.source.name.replace(/\.[^.]+$/, '')
  const [title, setTitle] = useState(savedTitle)
  const [bodies, setBodies] = useState<Record<string, string>>(() =>
    Object.fromEntries(articleSlides.map((slide) => [slide.id, slide.transcript?.articleBody ?? ''])),
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const isDirty =
    title.trim() !== savedTitle ||
    articleSlides.some((slide) => bodies[slide.id] !== (slide.transcript?.articleBody ?? ''))
  const hasEmptyTitle = !title.trim()
  const hasEmptyBody = articleSlides.some((slide) => !(bodies[slide.id] ?? '').trim())

  const handleBodyChange = (slideId: string, body: string) => {
    setBodies((current) => ({ ...current, [slideId]: body }))
    setSaveError(null)
  }

  const handleSave = async () => {
    if (!isDirty || hasEmptyTitle || hasEmptyBody) return

    setIsSaving(true)
    setSaveError(null)
    try {
      await onSave({ title: title.trim(), bodies })
      setIsEditing(false)
    } catch (error) {
      console.error(error)
      setSaveError(error instanceof Error ? error.message : '記事の保存に失敗しました。')
    } finally {
      setIsSaving(false)
    }
  }

  const handleStartEditing = () => {
    setIsEditing(true)
    setSaveError(null)
  }

  const handleCancelEditing = () => {
    if (isDirty && !window.confirm('未保存の変更を破棄して、プレビューに戻りますか？')) return

    setTitle(savedTitle)
    setBodies(
      Object.fromEntries(
        articleSlides.map((slide) => [slide.id, slide.transcript?.articleBody ?? '']),
      ),
    )
    setIsEditing(false)
    setSaveError(null)
  }

  const handleBack = () => {
    if (isDirty && !window.confirm('未保存の変更があります。保存せずに解析へ戻りますか？')) return
    onBack()
  }

  return (
    <main className="flex min-h-svh flex-col bg-[#f4f7f4] font-[Avenir_Next,Hiragino_Sans,Yu_Gothic,system-ui,sans-serif] text-[18px] leading-[1.45] tracking-[0.18px] text-[#18211f]">
      <AppHeader
        onOpenProjects={onOpenProjects}
        projectsDisabled={isEditing || isDirty || isSaving}
      />
      <WorkflowBar activeStep="article-review" />

      <section className="mx-auto flex w-[calc(100%-48px)] max-w-[1040px] flex-1 flex-col pb-12 md:w-[calc(100%-11.6vw)]">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">04 / ARTICLE PREVIEW</p>
            <h1 className="mt-1 text-[27px] font-bold tracking-[-0.06em]">記事プレビュー</h1>
            <p className="mt-1 text-xs text-[#71807b]">生成した記事をプレビューします。必要に応じて編集できます。</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-[#71807b] transition hover:bg-[#e2eee8] hover:text-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30"
              type="button"
              onClick={handleBack}
            >
              <ArrowLeft size={15} strokeWidth={1.8} />
              解析に戻る
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[18px] border border-[#b7cbc0] bg-[#fbfcfa] shadow-[0_18px_52px_rgba(22,54,42,0.07)]">
          <div className="border-b border-[#d8e1dc] px-5 py-5 md:px-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0 flex-1">
                {isEditing ? (
                  <>
                    <label className="block text-xs font-semibold text-[#18211f]" htmlFor="article-title">
                      記事タイトル
                    </label>
                    <input
                      className="mt-2 w-full border-0 border-b border-[#b7cbc0] bg-transparent px-0 py-1 text-[23px] font-bold tracking-[-0.05em] text-[#18211f] outline-none transition placeholder:text-[#9aa6a1] focus:border-[#1d6b50]"
                      id="article-title"
                      value={title}
                      onChange={(event) => {
                        setTitle(event.target.value)
                        setSaveError(null)
                      }}
                      placeholder="記事タイトル"
                    />
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-[#71807b]">記事タイトル</p>
                    <h2 className="mt-2 text-[23px] font-bold tracking-[-0.05em] text-[#18211f]">
                      {title}
                    </h2>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs">
                {isEditing ? (
                  <>
                    <span className={saveError ? 'text-[#b6533a]' : isDirty ? 'text-[#9a7a35]' : 'text-[#71807b]'}>
                      {isSaving
                        ? '保存中…'
                        : saveError
                          ? '保存に失敗しました'
                          : isDirty
                            ? '未保存の変更'
                            : '変更なし'}
                    </span>
                    <button
                      className="inline-flex items-center gap-2 rounded-[9px] border border-[#d8e1dc] px-3 py-2.5 text-xs font-semibold text-[#71807b] transition hover:border-[#9aa6a1] hover:bg-[#f1f3f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50"
                      type="button"
                      onClick={handleCancelEditing}
                      disabled={isSaving}
                    >
                      <X size={14} />
                      編集をやめる
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-[9px] bg-[#1d6b50] px-4 py-2.5 text-xs font-semibold text-[#f3faf6] transition hover:bg-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={!isDirty || hasEmptyTitle || hasEmptyBody || isSaving}
                    >
                      <Save size={14} />
                      保存
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="inline-flex items-center gap-2 rounded-[9px] border border-[#b7cbc0] bg-[#fbfcfa] px-3 py-2.5 text-xs font-semibold text-[#1d6b50] transition hover:border-[#1d6b50] hover:bg-[#e2eee8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30"
                      type="button"
                      onClick={handleStartEditing}
                    >
                      <FilePenLine size={14} />
                      編集
                    </button>
                  </>
                )}
              </div>
            </div>
            {isEditing && hasEmptyTitle && (
              <p className="mt-3 text-xs text-[#b6533a]">記事タイトルを入力してください。</p>
            )}
            {isEditing && hasEmptyBody && (
              <p className="mt-3 text-xs text-[#b6533a]">本文が空のSlideがあります。本文を入力してから保存してください。</p>
            )}
            {isEditing && saveError && <p className="mt-3 text-xs text-[#b6533a]">{saveError}</p>}
          </div>

          <div className="space-y-5 p-5 md:p-7">
            {articleSlides.length > 0 ? (
              articleSlides.map((slide) => (
                <ArticleSectionEditor
                  key={slide.id}
                  slide={slide}
                  body={bodies[slide.id] ?? ''}
                  editing={isEditing}
                  onBodyChange={(body) => handleBodyChange(slide.id, body)}
                  disabled={isSaving}
                />
              ))
            ) : (
              <div className="border-y border-dashed border-[#b7cbc0] px-4 py-10 text-center text-xs text-[#71807b]">
                文字起こし済みの記事本文がありません。
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            className="inline-flex items-center gap-2 rounded-[9px] bg-[#1d6b50] px-4 py-3 text-xs font-semibold text-[#f3faf6] shadow-[0_7px_16px_rgba(29,107,80,0.17)] transition hover:bg-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            type="button"
            onClick={onExport}
            disabled={isEditing || isDirty || isSaving || hasEmptyTitle || hasEmptyBody}
            title={isDirty ? '先に変更を保存してください' : undefined}
          >
            Exportへ
            <ArrowRight size={14} />
          </button>
        </div>
      </section>
    </main>
  )
}
