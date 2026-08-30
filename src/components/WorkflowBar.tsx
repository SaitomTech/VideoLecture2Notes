const WORKFLOW_STEPS = [
  'Import',
  'Crop',
  'Detect slides',
  'Generate notes',
  'Export',
]

export function WorkflowBar() {
  return (
    <nav
      className="mx-auto flex h-[84px] w-full max-w-[1040px] items-center justify-center gap-3 overflow-hidden px-6 md:gap-4"
      aria-label="処理ステップ"
    >
      {WORKFLOW_STEPS.map((step, index) => (
        <div className="flex shrink-0 items-center gap-3 md:gap-4" key={step}>
          <div
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.04em] ${index === 0 ? 'font-medium text-[#1d6b50]' : 'text-[#a0aba6]'}`}
          >
            <span className="text-[10px]">{String(index + 1).padStart(2, '0')}</span>
            <span className={index === 0 ? '' : 'max-[820px]:hidden'}>{step}</span>
          </div>
          {index < WORKFLOW_STEPS.length - 1 && (
            <span className="h-px w-10 bg-[#d8e1dc] md:w-16" aria-hidden="true" />
          )}
        </div>
      ))}
    </nav>
  )
}
