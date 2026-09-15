import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useDialogA11y<T extends HTMLElement = HTMLDialogElement>({
  open,
  onClose,
  closeDisabled = false,
}: {
  open: boolean
  onClose: () => void
  closeDisabled?: boolean
}) {
  const dialogRef = useRef<T>(null)
  const onCloseRef = useRef(onClose)
  const closeDisabledRef = useRef(closeDisabled)

  useEffect(() => {
    onCloseRef.current = onClose
    closeDisabledRef.current = closeDisabled
  }, [closeDisabled, onClose])

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const focusable = () =>
      [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
        (element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true',
      )
    const focusFirst = () => {
      focusable()[0]?.focus()
      if (document.activeElement === dialog) dialog.focus()
    }
    const frame = requestAnimationFrame(focusFirst)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (closeDisabledRef.current) return
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const elements = focusable()
      if (elements.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = elements[0]
      const last = elements.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target === dialog && !closeDisabledRef.current) onCloseRef.current()
    }
    const handleCancel = (event: Event) => {
      event.preventDefault()
      if (!closeDisabledRef.current) onCloseRef.current()
    }
    dialog.addEventListener('keydown', handleKeyDown)
    dialog.addEventListener('pointerdown', handlePointerDown)
    dialog.addEventListener('cancel', handleCancel)
    return () => {
      cancelAnimationFrame(frame)
      dialog.removeEventListener('keydown', handleKeyDown)
      dialog.removeEventListener('pointerdown', handlePointerDown)
      dialog.removeEventListener('cancel', handleCancel)
      previouslyFocused?.focus()
    }
  }, [open])

  return dialogRef
}
