export type WorkflowStep =
  | 'import'
  | 'crop'
  | 'detect-slides'
  | 'generate-notes'
  | 'article-review'
  | 'export'

export const WORKFLOW_STEPS: Array<{ id: WorkflowStep; label: string }> = [
  { id: 'import', label: 'Import' },
  { id: 'crop', label: 'Crop & Trim' },
  { id: 'detect-slides', label: 'Detect slides' },
  { id: 'generate-notes', label: 'Generate notes' },
  { id: 'article-review', label: 'Article preview' },
  { id: 'export', label: 'Result' },
]

export function getWorkflowStepIndex(step: WorkflowStep) {
  return WORKFLOW_STEPS.findIndex((workflowStep) => workflowStep.id === step)
}
