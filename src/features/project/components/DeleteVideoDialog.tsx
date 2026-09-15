import { useState } from 'react'
import type { ProjectVideo } from '../../../types/project'
import { ConfirmDialog } from './ConfirmDialog'
export function DeleteVideoDialog({
  video,
  onClose,
  onConfirm,
}: {
  video: ProjectVideo
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '動画を削除できませんでした。')
    } finally {
      setBusy(false)
    }
  }
  return (
    <ConfirmDialog
      open
      eyebrow="Delete video"
      title="動画を削除"
      subject={`「${video.title}」をプロジェクトから削除しますか？`}
      description="保存されている元動画のコピーも削除されます。作成済みの記事はそのまま残ります。"
      error={error}
      busy={busy}
      dialogTitleId="delete-video-title"
      closeLabel="動画削除を閉じる"
      onClose={onClose}
      onConfirm={() => void confirm()}
    />
  )
}
