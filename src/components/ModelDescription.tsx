import type { ReactNode } from 'react'

type ModelDescriptionProps = {
  description: string
  annotation: ReactNode
  children?: ReactNode
}

export function ModelDescription({ description, annotation, children }: ModelDescriptionProps) {
  return (
    <>
      <span className="mt-2 block text-xs leading-5 text-[#52635c]">{description}</span>
      <span className="mt-1 block text-[10px] leading-4 text-[#9aa6a1]">{annotation}</span>
      {children}
    </>
  )
}
