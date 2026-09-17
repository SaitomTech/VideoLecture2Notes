import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { AppHeader } from '../../components/AppHeader'
import { ArticleContextRow } from '../../components/ArticleContextRow'
import { WorkflowBar } from '../../components/WorkflowBar'
import { WorkflowPanelHeader } from '../../components/WorkflowPanelHeader'
import { getArticleModel, type ArticleModelId } from '../../lib/article/articleModel'
import type { WorkflowStep } from '../../lib/workflow'
import type {
  ArticleDraft,
  ArticleSummary,
  ContentProcessingResult,
  MediaProject,
} from '../../types/project'
import { ArticleSummaryCard } from './components/ArticleSummaryCard'
import { ArticleSectionEditor } from './components/ArticleSectionEditor'
import { ArticleNavigationBar } from './components/ArticleNavigationBar'
import { useArticleSummary } from './hooks/useArticleSummary'
import {
  ContentProcessingPanel,
  ContentProcessingStatus,
} from '../content-processing/components/ContentProcessingPanel'
import type { ContentProcessingSlideCompleted } from '../content-processing/contentProcessing'
import { useContentProcessing } from '../content-processing/hooks/useContentProcessing'
import { getActiveArticleSourceContext } from '../../lib/project/articleSource'

type ArticleReviewPageProps = {
  project: MediaProject
  onContentSlideCompleted: ContentProcessingSlideCompleted
  getCurrentProject: () => MediaProject | null
  onSave: (draft: ArticleDraft) => void | Promise<void>
  onSaveSummary: (summary: ArticleSummary) => void | Promise<void>
  onExport: () => void
  onHome: () => void
  onBackToProject: () => void
  onOpenArticle: (articleId: string) => void | Promise<void>
  onSaveTitle: (title: string) => void | Promise<void>
  maxReachedStep: WorkflowStep
  onStepClick: (step: WorkflowStep) => void
}

type EditingTarget = { type: 'slide'; slideId: string } | null

export function ArticleReviewPage({
  project,
  onContentSlideCompleted,
  getCurrentProject,
  onSave,
  onSaveSummary,
  onExport,
  onHome,
  onBackToProject,
  onOpenArticle,
  onSaveTitle,
  maxReachedStep,
  onStepClick,
}: ArticleReviewPageProps) {
  const articleSlides = project.slides.filter((slide) => Boolean(slide.transcript))
  const sourcePath = getActiveArticleSourceContext(project).source.path
  const activeArticle = project.articles.find((article) => article.id === project.activeArticleId)
  const articleTitle =
    activeArticle?.title.trim() ||
    project.article?.title?.trim() ||
    project.source.name.replace(/\.[^.]+$/, '')
  const [summaryModelId, setSummaryModelId] = useState<ArticleModelId>(
    () =>
      getArticleModel(project.article?.summary?.model ?? articleSlides[0]?.transcript?.articleModel)
        .id,
  )
  const summaryGeneration = useArticleSummary(project, summaryModelId, onSaveSummary)
  const storedTextModelId = project.slides
    .map((slide) => slide.transcript?.articleModel)
    .find((modelId): modelId is string => Boolean(modelId))
  const [textModelId, setTextModelId] = useState<ArticleModelId>(
    () => getArticleModel(storedTextModelId).id,
  )
  const textModel = getArticleModel(textModelId)
  const initialBodies = Object.fromEntries(
    articleSlides.map((slide) => [slide.id, slide.transcript?.articleBody ?? '']),
  )
  const [savedBodies, setSavedBodies] = useState<Record<string, string>>(initialBodies)
  const [editingTarget, setEditingTarget] = useState<EditingTarget>(null)
  const [bodyDraft, setBodyDraft] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [switchingArticleId, setSwitchingArticleId] = useState<string | null>(null)

  const handleContentSlideCompleted = async (slideId: string, result: ContentProcessingResult) => {
    await onContentSlideCompleted(slideId, result)
    setSavedBodies((current) => ({ ...current, [slideId]: result.article.body }))
  }

  const processing = useContentProcessing(
    project,
    handleContentSlideCompleted,
    textModelId,
    getCurrentProject,
  )

  const editingSlideId = editingTarget?.type === 'slide' ? editingTarget.slideId : null
  const isBodyDirty = editingSlideId !== null && bodyDraft !== (savedBodies[editingSlideId] ?? '')
  const hasUnsavedChanges = isBodyDirty
  const isBusy =
    isSaving || summaryGeneration.status === 'running' || processing.status === 'running'
  const contentControlsDisabled =
    isSaving || summaryGeneration.status === 'running' || hasUnsavedChanges
  const canEdit = editingTarget === null && !isBusy

  const handleTextModelChange = (nextModelId: ArticleModelId) => {
    processing.reset()
    setTextModelId(nextModelId)
  }

  const startSlideEditing = (slideId: string) => {
    if (!canEdit) return
    setBodyDraft(savedBodies[slideId] ?? '')
    setEditingTarget({ type: 'slide', slideId })
    setSaveError(null)
  }

  const cancelEditing = () => {
    setEditingTarget(null)
    setBodyDraft('')
    setSaveError(null)
  }

  const saveSlide = async () => {
    if (editingSlideId === null || !isBodyDirty) return

    setIsSaving(true)
    setSaveError(null)
    try {
      const nextBodies = { ...savedBodies, [editingSlideId]: bodyDraft }
      await onSave({ title: articleTitle, bodies: nextBodies })
      setSavedBodies(nextBodies)
      setBodyDraft('')
      setEditingTarget(null)
    } catch (error) {
      console.error(error)
      setSaveError(error instanceof Error ? error.message : '記事の保存に失敗しました。')
    } finally {
      setIsSaving(false)
    }
  }

  const switchArticle = async (articleId: string) => {
    if (articleId === project.activeArticleId) {
      return true
    }
    if (switchingArticleId || isSaving || summaryGeneration.status === 'running') return false

    if (hasUnsavedChanges) {
      const nextBodies = { ...savedBodies, [editingSlideId!]: bodyDraft }
      setIsSaving(true)
      setSaveError(null)
      try {
        await onSave({ title: articleTitle, bodies: nextBodies })
        setSavedBodies(nextBodies)
        setBodyDraft('')
        setEditingTarget(null)
      } catch (error) {
        console.error(error)
        setSaveError(error instanceof Error ? error.message : '記事の保存に失敗しました。')
        return false
      } finally {
        setIsSaving(false)
      }
    }

    setSwitchingArticleId(articleId)
    try {
      await onOpenArticle(articleId)
      return true
    } catch (error) {
      console.error(error)
      setSaveError(error instanceof Error ? error.message : '記事を切り替えられませんでした。')
      return false
    } finally {
      setSwitchingArticleId(null)
    }
  }

  const handleWorkflowNavigation = (nextStep: WorkflowStep) => {
    if (hasUnsavedChanges && !window.confirm('未保存の変更があります。保存せずに移動しますか？'))
      return
    onStepClick(nextStep)
  }

  return (
    <main className="flex min-h-svh flex-col bg-[#f4f7f4] font-[Avenir_Next,Hiragino_Sans,Yu_Gothic,system-ui,sans-serif] text-[18px] leading-[1.45] tracking-[0.18px] text-[#18211f]">
      <AppHeader activeNav="projects" onHome={onHome} homeDisabled={hasUnsavedChanges || isBusy} />
      <div className="mx-auto flex min-h-[56px] w-[calc(100%-48px)] max-w-[1040px] items-center md:w-[calc(100%-11.6vw)]">
        <ArticleNavigationBar
          onBack={onBackToProject}
          disabled={isBusy || switchingArticleId !== null}
        />
      </div>
      <ArticleContextRow
        project={project}
        sourceName={project.source.name}
        onSelect={switchArticle}
        onSaveTitle={onSaveTitle}
        disabled={isBusy || switchingArticleId !== null || editingSlideId !== null}
      />

      <section className="mx-auto flex w-[calc(100%-48px)] max-w-[1040px] flex-1 flex-col pb-12 md:w-[calc(100%-11.6vw)]">
        <WorkflowBar
          activeStep="article-review"
          maxReachedStep={maxReachedStep}
          onStepClick={handleWorkflowNavigation}
          disabled={isBusy}
        />
        <div className="overflow-hidden rounded-[18px] border border-[#b7cbc0] bg-[#fbfcfa] shadow-[0_18px_52px_rgba(22,54,42,0.07)]">
          <WorkflowPanelHeader
            eyebrow="04 / ARTICLE GENERATION & EDITING"
            title="記事の生成・編集"
            description="記事を生成し、内容や表示を編集します。"
          />

          <div className="space-y-10 p-5 md:p-7">
            <section aria-labelledby="content-processing-heading">
              <ContentProcessingPanel
                project={project}
                processing={processing}
                model={textModel}
                modelId={textModelId}
                onModelChange={handleTextModelChange}
                disabled={contentControlsDisabled || switchingArticleId !== null}
              />
              <div className="mt-6">
                <ContentProcessingStatus
                  processing={processing}
                  disabled={contentControlsDisabled || switchingArticleId !== null}
                />
              </div>
            </section>
            <section aria-labelledby="article-review-heading">
              <div>
                <h2
                  id="article-review-heading"
                  className="text-[21px] font-bold tracking-[-0.05em]"
                >
                  2. 記事本文の確認・編集
                </h2>
                <p className="mt-1 text-xs text-[#71807b]">
                  生成された本文を確認し、必要に応じて修正できます。
                </p>
              </div>
              <div className="mt-5 space-y-5">
                <ArticleSummaryCard
                  project={project}
                  summary={project.article?.summary}
                  generation={summaryGeneration}
                  modelId={summaryModelId}
                  onModelChange={setSummaryModelId}
                  disabled={isBusy || hasUnsavedChanges}
                  onGenerate={(force) => void summaryGeneration.generate(force)}
                  onCancel={summaryGeneration.cancel}
                  onSave={onSaveSummary}
                />
                {articleSlides.length > 0 ? (
                  articleSlides.map((slide) => {
                    const isEditing = editingSlideId === slide.id
                    return (
                      <ArticleSectionEditor
                        key={slide.id}
                        slide={slide}
                        videoPath={sourcePath}
                        body={isEditing ? bodyDraft : (savedBodies[slide.id] ?? '')}
                        editing={isEditing}
                        editDisabled={!isEditing && !canEdit}
                        saving={isSaving && isEditing}
                        canSave={isBodyDirty}
                        error={isEditing ? saveError : null}
                        onEdit={() => startSlideEditing(slide.id)}
                        onCancel={cancelEditing}
                        onSave={() => void saveSlide()}
                        onBodyChange={(body) => {
                          setBodyDraft(body)
                          setSaveError(null)
                        }}
                      />
                    )
                  })
                ) : (
                  <div className="border-y border-dashed border-[#b7cbc0] px-4 py-10 text-center text-xs text-[#71807b]">
                    文字起こし済みの記事本文がありません。
                  </div>
                )}
              </div>
            </section>
          </div>
          <div
            className={`flex flex-wrap items-center gap-4 border-t border-[#d8e1dc] px-5 py-4 md:px-7 ${hasUnsavedChanges ? 'justify-between' : 'justify-end'}`}
          >
            {hasUnsavedChanges && (
              <p className="text-xs text-[#9a7a35]">
                未保存の変更があります。保存してから書き出せます。
              </p>
            )}
            <button
              className="inline-flex items-center gap-2 rounded-[9px] bg-[#1d6b50] px-4 py-3 text-xs font-semibold text-[#f3faf6] shadow-[0_7px_16px_rgba(29,107,80,0.17)] transition hover:bg-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              type="button"
              onClick={onExport}
              disabled={hasUnsavedChanges || isBusy}
              title={hasUnsavedChanges ? '編集中の変更を保存してください' : undefined}
            >
              閲覧・ダウンロードへ
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
