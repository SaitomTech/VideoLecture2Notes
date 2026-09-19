type WorkflowPanelHeaderProps = {
  eyebrow: string
  title: string
  description: string
}

export function WorkflowPanelHeader({ eyebrow, title, description }: WorkflowPanelHeaderProps) {
  return (
    <header className="border-b border-[#d8e1dc] px-5 py-3 md:px-7">
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#71807b]">
          {eyebrow}
        </p>
        <h2 className="mt-0.5 text-[19px] font-bold tracking-[-0.05em]">{title}</h2>
        <p className="mt-0.5 text-xs leading-5 text-[#71807b]">{description}</p>
      </div>
    </header>
  )
}
