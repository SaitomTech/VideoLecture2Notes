import { useRef, useState, type CompositionEvent, type FocusEvent, type KeyboardEvent } from 'react'

export function useProjectTitleEditor({
  initialTitle,
  onSave,
}: {
  initialTitle: string
  onSave: (title: string) => Promise<void>
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(initialTitle)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cancelBlurRef = useRef(false)
  const savingRef = useRef(false)
  const composingRef = useRef(false)
  const lastCompositionEndRef = useRef(0)

  const startEditing = () => {
    setDraft(initialTitle)
    setError(null)
    cancelBlurRef.current = false
    setIsEditing(true)
  }

  const cancelEditing = () => {
    cancelBlurRef.current = true
    setDraft(initialTitle)
    setIsEditing(false)
    setError(null)
  }

  const save = async () => {
    if (savingRef.current) return
    savingRef.current = true
    setIsSaving(true)
    setError(null)
    try {
      await onSave(draft)
      setIsEditing(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'プロジェクト名を変更できませんでした。')
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const recentlyComposed = Date.now() - lastCompositionEndRef.current < 120
    if (
      event.nativeEvent.isComposing ||
      composingRef.current ||
      event.keyCode === 229 ||
      recentlyComposed
    )
      return
    if (event.key === 'Enter') {
      event.preventDefault()
      void save()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelEditing()
    }
  }

  const handleBlur = (_event: FocusEvent<HTMLInputElement>) => {
    if (composingRef.current || Date.now() - lastCompositionEndRef.current < 120) return
    if (cancelBlurRef.current) {
      cancelBlurRef.current = false
      return
    }
    void save()
  }

  const handleCompositionStart = (_event: CompositionEvent<HTMLInputElement>) => {
    composingRef.current = true
  }

  const handleCompositionEnd = (_event: CompositionEvent<HTMLInputElement>) => {
    composingRef.current = false
    lastCompositionEndRef.current = Date.now()
  }

  return {
    isEditing,
    draft,
    isSaving,
    error,
    setDraft,
    startEditing,
    handleKeyDown,
    handleBlur,
    handleCompositionStart,
    handleCompositionEnd,
  }
}
