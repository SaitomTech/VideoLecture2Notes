import { ConfirmDialog } from './ConfirmDialog'

export function DeleteProjectDialog({
  open,
  title,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  busy: boolean
  error: string | null
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <ConfirmDialog
      open={open}
      eyebrow="Delete project"
      title="プロジェクトを削除しますか？"
      subject={title}
      description="動画、記事、解析結果、出力ファイルをすべて削除します。この操作は元に戻せません。"
      error={error}
      busy={busy}
      dialogTitleId="delete-project-title"
      closeLabel="プロジェクト削除を閉じる"
      onClose={onClose}
      onConfirm={onConfirm}
    />
  )
}
