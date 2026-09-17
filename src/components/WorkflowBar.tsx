import { getWorkflowStepIndex, WORKFLOW_STEPS, type WorkflowStep } from '../lib/workflow'

type WorkflowBarProps = {
  activeStep?: WorkflowStep
  maxReachedStep?: WorkflowStep
  onStepClick?: (step: WorkflowStep) => void
  disabled?: boolean
}

export function WorkflowBar({
  activeStep = 'import',
  maxReachedStep = activeStep,
  onStepClick,
  disabled = false,
}: WorkflowBarProps) {
  const steps =
    activeStep === 'import' ? [{ id: 'import' as const, label: 'Import' }] : WORKFLOW_STEPS
  const activeIndex = steps.findIndex((step) => step.id === activeStep)
  const maxReachedIndex = getWorkflowStepIndex(maxReachedStep)

  return (
    <nav
      className="mb-3 flex min-w-0 w-full items-center justify-start gap-2 overflow-x-auto py-1 sm:gap-2.5 md:gap-3 min-[1060px]:justify-center"
      aria-label="処理ステップ"
    >
      {steps.map((step, index) => {
        const isActive = index === activeIndex
        const isReached = index <= maxReachedIndex
        const isNavigable = Boolean(onStepClick) && isReached && !isActive
        const stepClassName = `group flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[8px] px-1 py-1 font-mono text-[10px] uppercase tracking-[0.04em] transition ${isActive ? 'font-medium text-[#174d3c]' : isReached ? 'font-medium text-[#1d6b50]' : 'text-[#a0aba6]'}`
        const stepNumberClassName = `grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] transition ${isActive ? 'border-[#1d6b50] bg-[#1d6b50] text-[#f3faf6]' : isReached ? 'border-[#b7cbc0] bg-[#e8f2ec] text-[#1d6b50]' : 'border-[#d8e1dc] bg-[#f2f5f3] text-[#9aa6a1]'}`
        const stepLabel = (
          <>
            <span className={stepNumberClassName}>{String(index + 1).padStart(2, '0')}</span>
            <span
              className={`${index === 0 || isActive ? '' : 'max-[820px]:hidden'} ${isActive ? 'border-b-2 border-[#1d6b50] pb-1' : ''}`}
            >
              {step.label}
            </span>
          </>
        )

        const stepControl = isNavigable ? (
          <button
            className={`${stepClassName} cursor-pointer hover:bg-[#e2eee8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50`}
            type="button"
            onClick={() => onStepClick?.(step.id)}
            disabled={disabled}
            aria-label={`${step.label}へ移動`}
          >
            {stepLabel}
          </button>
        ) : (
          <div
            className={stepClassName}
            aria-current={isActive ? 'step' : undefined}
            aria-disabled={!isReached ? true : undefined}
          >
            {stepLabel}
          </div>
        )

        return (
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2" key={step.id}>
            {stepControl}
            {index < steps.length - 1 && (
              <span
                className={`h-px w-4 shrink-0 sm:w-5 ${isReached ? 'bg-[#a9c9b7]' : 'bg-[#d8e1dc]'}`}
                aria-hidden="true"
              />
            )}
          </div>
        )
      })}
    </nav>
  )
}
