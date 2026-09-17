import type { WorkflowStep } from '../lib/workflow'
import { WorkflowBar } from './WorkflowBar'

type WorkflowPanelHeaderProps = {
  activeStep: WorkflowStep
  maxReachedStep: WorkflowStep
  onStepClick: (step: WorkflowStep) => void
  disabled?: boolean
  eyebrow: string
  title: string
  description: string
}

export function WorkflowPanelHeader({
  activeStep,
  maxReachedStep,
  onStepClick,
  disabled = false,
  eyebrow,
  title,
  description,
}: WorkflowPanelHeaderProps) {
  return (
    <header className="border-b border-[#d8e1dc] px-5 py-3 md:px-7">
      <div className="flex flex-col gap-3 min-[1060px]:grid min-[1060px]:grid-cols-[260px_minmax(0,1fr)] min-[1060px]:items-center min-[1060px]:gap-5">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">
            {eyebrow}
          </p>
          <h2 className="mt-0.5 text-[19px] font-bold tracking-[-0.05em]">{title}</h2>
          <p className="mt-0.5 text-xs leading-5 text-[#71807b]">{description}</p>
        </div>
        <WorkflowBar
          activeStep={activeStep}
          maxReachedStep={maxReachedStep}
          onStepClick={onStepClick}
          disabled={disabled}
        />
      </div>
    </header>
  )
}
