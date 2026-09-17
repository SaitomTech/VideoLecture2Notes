import { RefreshCw, X } from 'lucide-react'
import { useDialogA11y } from '../../../lib/ui/useDialogA11y'

export function CreateProjectDialog({
  open,
  title,
  busy,
  onTitleChange,
  onClose,
  onSubmit,
}: {
  open: boolean
  title: string
  busy: boolean
  onTitleChange: (title: string) => void
  onClose: () => void
  onSubmit: () => void
}) {
  const dialogRef = useDialogA11y({ open, onClose, closeDisabled: busy })
  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-0 grid h-full w-full max-w-none place-items-center border-0 bg-[#18211f]/35 px-5 backdrop-blur-[2px]"
      open
      aria-labelledby="create-project-title"
    >
      <section className="w-full max-w-[430px] rounded-[16px] border border-[#b7cbc0] bg-white p-6 shadow-[0_24px_70px_rgba(24,33,31,0.2)]">
        <div className="flex items-center justify-between">
          <h2 id="create-project-title" className="text-[18px] font-bold">
            新規プロジェクト
          </h2>
          <button
            className="rounded-md p-1.5 text-[#71807b] hover:bg-[#e8f2ec]"
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="新規プロジェクトを閉じる"
          >
            <X size={17} />
          </button>
        </div>
        <label className="mt-6 block text-xs font-semibold text-[#53615b]">
          プロジェクト名
          <input
            autoFocus
            className="mt-2 h-11 w-full rounded-[8px] border border-[#b7cbc0] bg-white px-3 text-sm outline-none focus:border-[#1d6b50]"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onSubmit()
            }}
            placeholder="例：2026 春の講演会"
          />
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button
            className="rounded-[8px] px-3 py-2.5 text-xs font-semibold text-[#71807b] hover:bg-[#eef3ef]"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            キャンセル
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-[8px] bg-[#1d6b50] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
            type="button"
            disabled={!title.trim() || busy}
            onClick={onSubmit}
          >
            {busy && <RefreshCw className="animate-spin" size={13} />}作成
          </button>
        </div>
      </section>
    </dialog>
  )
}
