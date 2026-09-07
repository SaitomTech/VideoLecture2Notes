export type WorkflowStep =
  | 'import'
  | 'crop'
  | 'detect-slides'
  | 'generate-notes'
  | 'article-review'
  | 'export'

const WORKFLOW_STEPS: Array<{ id: WorkflowStep; label: string }> = [
  { id: 'import', label: 'Import' },
  { id: 'crop', label: 'Crop & Trim' },
  { id: 'detect-slides', label: 'Detect slides' },
  { id: 'generate-notes', label: 'Generate notes' },
  { id: 'article-review', label: 'Article preview' },
  { id: 'export', label: 'Export' },
]

type WorkflowBarProps = {
  activeStep?: WorkflowStep
}

export function WorkflowBar({ activeStep = 'import' }: WorkflowBarProps) {
  const activeIndex = WORKFLOW_STEPS.findIndex((step) => step.id === activeStep)

  return (
    <nav
      className="mx-auto flex h-[84px] w-full max-w-[1040px] items-center justify-center gap-3 overflow-hidden px-6 md:gap-4"
      aria-label="処理ステップ"
    >
      {WORKFLOW_STEPS.map((step, index) => {
        const isActive = index === activeIndex
        const isCompleted = index < activeIndex

        return (
          <div className="flex shrink-0 items-center gap-3 md:gap-4" key={step.id}>
            <div
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.04em] ${isActive || isCompleted ? 'font-medium text-[#1d6b50]' : 'text-[#a0aba6]'}`}
            >
              <span className="text-[10px]">{String(index + 1).padStart(2, '0')}</span>
              <span className={index === 0 || isActive ? '' : 'max-[820px]:hidden'}>{step.label}</span>
            </div>
            {index < WORKFLOW_STEPS.length - 1 && (
              <span className="h-px w-10 bg-[#d8e1dc] md:w-16" aria-hidden="true" />
            )}
          </div>
        )
      })}
    </nav>
  )
}
