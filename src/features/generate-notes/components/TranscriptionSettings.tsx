import { RefreshCw } from 'lucide-react'
import { DEFAULT_WHISPER_MODEL } from '../../../lib/whisper/modelManager'
import type { TranscriptionLanguage } from '../transcription'
import type { TranscriptionStatus } from '../hooks/useTranscription'

type TranscriptionSettingsProps = {
  language: TranscriptionLanguage
  status: TranscriptionStatus
  disabled?: boolean
  onLanguageChange: (language: TranscriptionLanguage) => void
  onTranscribe: () => void | Promise<void>
}

export function TranscriptionSettings({
  language,
  status,
  disabled = false,
  onLanguageChange,
  onTranscribe,
}: TranscriptionSettingsProps) {
  const isRunning = status === 'running'
  const isCompleted = status === 'completed'
  const isDisabled = isRunning || disabled

  return (
    <section aria-labelledby="transcription-settings-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="transcription-settings-heading" className="text-[21px] font-bold tracking-[-0.05em]">
            文字起こし設定
          </h2>
          <p className="mt-1 text-xs text-[#71807b]">音声をMac内で解析し、Slideの区間へ割り当てます。</p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-[9px] bg-[#1d6b50] px-4 py-3 text-xs font-semibold text-[#f3faf6] shadow-[0_7px_16px_rgba(29,107,80,0.17)] transition hover:bg-[#174d3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={() => void onTranscribe()}
          disabled={isDisabled}
        >
          <RefreshCw size={14} className={isRunning ? 'animate-spin' : ''} />
          {isRunning ? '文字起こし中…' : isCompleted ? '再文字起こし' : '文字起こしを開始'}
        </button>
      </div>

      <div className="mt-5 grid gap-4 rounded-[12px] border border-[#d8e1dc] bg-[#f7faf7] p-4 md:grid-cols-2 md:p-5">
        <label className="block text-xs text-[#71807b]">
          <span className="block font-semibold text-[#18211f]">話し言葉の言語</span>
          <select
            className="mt-2 w-full rounded-[8px] border border-[#b7cbc0] bg-[#fbfcfa] px-3 py-2.5 text-sm text-[#18211f] outline-none focus:border-[#1d6b50] focus:ring-2 focus:ring-[#1d6b50]/20 disabled:opacity-50"
            value={language}
            onChange={(event) => onLanguageChange(event.target.value as TranscriptionLanguage)}
            disabled={isDisabled}
            aria-label="話し言葉の言語"
          >
            <option value="auto">自動判定</option>
            <option value="ja">日本語</option>
            <option value="en">英語</option>
          </select>
        </label>

        <div className="text-xs text-[#71807b]">
          <span className="block font-semibold text-[#18211f]">使用モデル</span>
          <p className="mt-2 font-mono text-[11px] text-[#1d6b50]">{DEFAULT_WHISPER_MODEL.label}</p>
          <p className="mt-1 text-[10px] text-[#9aa6a1]">初回のみモデルをダウンロードします（約547MB）。</p>
        </div>
      </div>
    </section>
  )
}
