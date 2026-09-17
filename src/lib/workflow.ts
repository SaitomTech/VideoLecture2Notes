export type WorkflowStep =
  | 'import'
  | 'crop'
  | 'detect-slides'
  | 'generate-notes'
  | 'article-review'
  | 'export'

export const WORKFLOW_STEPS: Array<{ id: WorkflowStep; label: string }> = [
  { id: 'crop', label: '時間範囲と表示領域を設定' },
  { id: 'detect-slides', label: 'スライドを検出' },
  { id: 'generate-notes', label: 'ノートを生成' },
  { id: 'article-review', label: '記事プレビュー' },
  { id: 'export', label: '書き出し' },
]

export function getWorkflowStepIndex(step: WorkflowStep) {
  return WORKFLOW_STEPS.findIndex((workflowStep) => workflowStep.id === step)
}

export function getFurthestWorkflowStep<T extends WorkflowStep>(first: T, second: T): T {
  return getWorkflowStepIndex(first) >= getWorkflowStepIndex(second) ? first : second
}

export function isWorkflowStepReached(maxReachedStep: WorkflowStep, step: WorkflowStep) {
  return getWorkflowStepIndex(step) <= getWorkflowStepIndex(maxReachedStep)
}

export function canNavigateToWorkflowStep(maxReachedStep: WorkflowStep, step: WorkflowStep) {
  return step !== 'import' && isWorkflowStepReached(maxReachedStep, step)
}
