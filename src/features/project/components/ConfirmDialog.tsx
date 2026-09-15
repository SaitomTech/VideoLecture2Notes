import { RefreshCw, X } from 'lucide-react'
import { useDialogA11y } from '../../../lib/ui/useDialogA11y'

export function ConfirmDialog({
  open,
  eyebrow,
  title,
  subject,
  description,
  error,
  busy,
  dialogTitleId,
  closeLabel,
  onClose,
  onConfirm,
}: {
  open: boolean
  eyebrow: string
  title: string
  subject?: string
  description: string
  error: string | null
  busy: boolean
  dialogTitleId: string
  closeLabel: string
  onClose: () => void
  onConfirm: () => void
}) {
  const dialogRef = useDialogA11y({ open, onClose, closeDisabled: busy })
  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-0 grid h-full w-full max-w-none place-items-center border-0 bg-[#18211f]/35 px-5 py-8 backdrop-blur-[2px]"
      open
      aria-modal="true"
      aria-labelledby={dialogTitleId}
    >
      <section className="w-full max-w-[460px] rounded-[16px] border border-[#d6a18f] bg-[#fffdfb] p-6 shadow-[0_24px_70px_rgba(24,33,31,0.2)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#71807b]">
              {eyebrow}
            </p>
            <h2 id={dialogTitleId} className="mt-1 text-[20px] font-bold tracking-[-0.04em]">
              {title}
            </h2>
          </div>
          <button
            className="rounded-md p-1.5 text-[#71807b] hover:bg-[#fff0e9] disabled:opacity-40"
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={closeLabel}
          >
            <X size={18} />
          </button>
        </div>
        {subject && <p className="mt-5 text-sm font-semibold text-[#18211f]">{subject}</p>}
        <p className={`${subject ? 'mt-2' : 'mt-5'} text-xs leading-5 text-[#71807b]`}>
          {description}
        </p>
        {error && (
          <p className="mt-3 text-xs text-[#b6533a]" role="alert">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            className="rounded-[8px] border border-[#b7cbc0] px-4 py-2.5 text-xs font-semibold text-[#53615b] hover:bg-[#eef3ef] disabled:opacity-40"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            キャンセル
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-[8px] bg-[#b6533a] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#98432f] disabled:opacity-40"
            type="button"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <RefreshCw className="animate-spin" size={13} />}
            {busy ? '削除中…' : '削除する'}
          </button>
        </div>
      </section>
    </dialog>
  )
}
