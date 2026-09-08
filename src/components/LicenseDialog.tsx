import { Check, Copy, Scale, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import appLicense from '../../LICENSE?raw'
import thirdPartyNotices from '../../THIRD_PARTY_NOTICES.md?raw'

type LicenseDocumentId = 'notice' | 'license'

const documents: Record<LicenseDocumentId, { label: string; contents: string }> = {
  notice: {
    label: '第三者NOTICE',
    contents: thirdPartyNotices,
  },
  license: {
    label: 'アプリのLICENSE',
    contents: appLicense,
  },
}

type LicenseDialogProps = {
  onClose: () => void
}

export function LicenseDialog({ onClose }: LicenseDialogProps) {
  const [selectedDocument, setSelectedDocument] = useState<LicenseDocumentId>('notice')
  const [copied, setCopied] = useState(false)
  const document = documents[selectedDocument]

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(document.contents)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1_500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <dialog
      className="fixed inset-0 z-50 m-0 grid h-full w-full max-h-none max-w-none place-items-center border-0 bg-[#18211f]/35 px-4 py-6 backdrop-blur-[2px]"
      open
      aria-modal="true"
      aria-labelledby="license-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className="flex max-h-full w-full max-w-[860px] flex-col overflow-hidden rounded-[16px] border border-[#b7cbc0] bg-[#fffdfb] shadow-[0_24px_70px_rgba(24,33,31,0.2)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#d8e1dc] px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e8f2ec] text-[#1d6b50]">
              <Scale size={17} />
            </span>
            <div className="min-w-0">
              <h2 id="license-dialog-title" className="text-sm font-bold text-[#18211f]">
                ライセンス情報
              </h2>
              <p className="mt-1 text-[10px] leading-4 text-[#71807b]">
                アプリ本体と、同梱・利用する外部コンポーネントのライセンスです。
              </p>
            </div>
          </div>
          <button
            className="shrink-0 rounded-md p-1.5 text-[#9aa6a1] transition hover:bg-[#eef3ef] hover:text-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25"
            type="button"
            onClick={onClose}
            aria-label="ライセンス情報を閉じる"
          >
            <X size={17} />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d8e1dc] bg-[#f7faf7] px-5 py-3 sm:px-6">
          <div className="flex items-center gap-1.5" aria-label="ライセンス文書">
            {(Object.keys(documents) as LicenseDocumentId[]).map((documentId) => {
              const isSelected = documentId === selectedDocument
              return (
                <button
                  key={documentId}
                  className={`rounded-[8px] px-3 py-2 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25 ${isSelected ? 'bg-[#e2eee8] text-[#174d3c]' : 'text-[#71807b] hover:bg-[#eef3ef] hover:text-[#174d3c]'}`}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedDocument(documentId)
                    setCopied(false)
                  }}
                >
                  {documents[documentId].label}
                </button>
              )
            })}
          </div>
          <button
            className="inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-2 text-[10px] font-semibold text-[#53615b] transition hover:bg-[#eef3ef] hover:text-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/25"
            type="button"
            onClick={() => void handleCopy()}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'コピーしました' : '本文をコピー'}
          </button>
        </div>

        <pre
          className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap px-5 py-5 font-mono text-[10px] leading-[1.65] text-[#53615b] sm:px-6"
          tabIndex={0}
        >
          {document.contents}
        </pre>
      </section>
    </dialog>
  )
}
