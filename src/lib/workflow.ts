export type WorkflowStep =
  | 'import'
  | 'detect-slides'
  | 'generate-notes'
  | 'article-review'
  | 'export'

export const WORKFLOW_STEPS: Array<{ id: WorkflowStep; label: string }> = [
  { id: 'detect-slides', label: 'Detect slides' },
  { id: 'generate-notes', label: 'Generate notes' },
  { id: 'article-review', label: 'Article preview' },
  { id: 'export', label: 'Result' },
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
