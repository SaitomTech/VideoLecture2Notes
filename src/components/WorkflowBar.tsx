import { getWorkflowStepIndex, WORKFLOW_STEPS } from '../lib/workflow'
import type { ReactNode } from 'react'
import type { WorkflowStep } from '../lib/workflow'

type WorkflowBarProps = {
  activeStep?: WorkflowStep
  maxReachedStep?: WorkflowStep
  onStepClick?: (step: WorkflowStep) => void
  disabled?: boolean
  leadingContent?: ReactNode
}

export function WorkflowBar({
  activeStep = 'import',
  maxReachedStep = activeStep,
  onStepClick,
  disabled = false,
  leadingContent,
}: WorkflowBarProps) {
  const steps =
    activeStep === 'import' ? [{ id: 'import' as const, label: 'Import' }] : WORKFLOW_STEPS
  const activeIndex = steps.findIndex((step) => step.id === activeStep)
  const maxReachedIndex = getWorkflowStepIndex(maxReachedStep)

  const navigation = (
    <nav
      className={`${leadingContent ? 'w-full ' : 'mx-auto w-full max-w-[1040px] '}flex h-[84px] items-center justify-start gap-0 overflow-x-auto px-4 sm:justify-center sm:gap-3 md:gap-4 md:px-4 min-[821px]:justify-start min-[1101px]:justify-center min-[1101px]:overflow-visible min-[1101px]:px-6`}
      aria-label="処理ステップ"
    >
      {steps.map((step, index) => {
        const isActive = index === activeIndex
        const isReached = index <= maxReachedIndex
        const isNavigable = Boolean(onStepClick) && isReached && !isActive
        const stepClassName = `flex shrink-0 items-center gap-1.5 rounded-[6px] whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.04em] transition ${isActive ? 'relative z-10 isolate font-medium text-[#174d3c] before:pointer-events-none before:absolute before:-inset-y-1.5 before:-inset-x-3 before:-z-10 before:rounded-[10px] before:border before:border-[#b7cbc0] before:bg-[#dcece3]' : isReached ? 'font-medium text-[#1d6b50]' : 'text-[#a0aba6]'}`
        const stepLabel = (
          <>
            <span className="text-[10px]">{String(index + 1).padStart(2, '0')}</span>
            <span className={index === 0 || isActive ? '' : 'max-[820px]:hidden'}>
              {step.label}
            </span>
          </>
        )

        return (
          <div className="flex shrink-0 items-center gap-3 md:gap-4" key={step.id}>
            {isNavigable ? (
              <button
                className={`${stepClassName} cursor-pointer hover:bg-[#e2eee8] hover:text-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 disabled:cursor-not-allowed disabled:opacity-50`}
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
            )}
            {index < steps.length - 1 && (
              <span className="h-px w-10 bg-[#d8e1dc] md:w-16" aria-hidden="true" />
            )}
          </div>
        )
      })}
    </nav>
  )

  if (!leadingContent) return navigation

  return (
    <div className="mx-auto flex w-[calc(100%-48px)] max-w-[1040px] flex-col overflow-hidden md:w-[calc(100%-11.6vw)]">
      <div className="flex min-h-[56px] w-full items-center">{leadingContent}</div>
      {navigation}
    </div>
  )
}
