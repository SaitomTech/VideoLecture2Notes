import { RefreshCw, Square } from 'lucide-react'
import {
  getWhisperModel,
  WHISPER_MODELS,
  type WhisperModelId,
} from '../../../lib/whisper/modelManager'
import type { TranscriptionLanguage } from '../transcription'
import type { TranscriptionStatus } from '../hooks/useTranscription'

type TranscriptionSettingsProps = {
  language: TranscriptionLanguage
  modelId: WhisperModelId
  status: TranscriptionStatus
  disabled?: boolean
  onLanguageChange: (language: TranscriptionLanguage) => void
  onModelChange: (modelId: WhisperModelId) => void
  onTranscribe: () => void | Promise<void>
  onCancel: () => void
}

function formatModelSize(bytes: number) {
  return bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(2)}GB`
    : `${Math.round(bytes / 1024 ** 2)}MB`
}

export function TranscriptionSettings({
  language,
  modelId,
  status,
  disabled = false,
  onLanguageChange,
  onModelChange,
  onTranscribe,
  onCancel,
}: TranscriptionSettingsProps) {
  const isRunning = status === 'running'
  const isCompleted = status === 'completed'
  const isDisabled = isRunning || disabled
  const model = getWhisperModel(modelId)

  return (
    <section aria-labelledby="transcription-settings-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3
            id="transcription-settings-heading"
            className="text-[15px] font-semibold text-[#18211f]"
          >
            音声データから文字を抽出
          </h3>
          <p className="mt-1 text-xs text-[#71807b]">
            音声をMac内で解析し、Slideの区間へ割り当てます。
          </p>
        </div>
        <button
          className={`inline-flex items-center justify-center gap-2 rounded-[9px] px-4 py-3 text-xs font-semibold shadow-[0_7px_16px_rgba(29,107,80,0.17)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d6b50]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${isRunning ? 'border border-[#d28d7a] bg-[#fff5f1] text-[#9d422d] shadow-none hover:bg-[#fbe8e2]' : 'bg-[#1d6b50] text-[#f3faf6] hover:bg-[#174d3c]'}`}
          type="button"
          onClick={() => (isRunning ? onCancel() : void onTranscribe())}
          disabled={disabled}
          aria-label={isRunning ? '文字起こしを停止' : undefined}
        >
          {isRunning ? <Square size={13} fill="currentColor" /> : <RefreshCw size={14} />}
          {isRunning ? '停止' : isCompleted ? '再文字起こし' : '文字起こしを開始'}
        </button>
      </div>

      <div className="mt-4 grid gap-4 rounded-[12px] border border-[#d8e1dc] bg-[#f7faf7] p-4 md:grid-cols-2 md:p-5">
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

        <label className="block text-xs text-[#71807b]" htmlFor="transcription-model">
          <span className="block font-semibold text-[#18211f]">使用モデル</span>
          <select
            id="transcription-model"
            className="mt-2 w-full rounded-[8px] border border-[#b7cbc0] bg-[#fbfcfa] px-3 py-2.5 text-sm text-[#18211f] outline-none focus:border-[#1d6b50] focus:ring-2 focus:ring-[#1d6b50]/20 disabled:cursor-not-allowed disabled:opacity-50"
            value={modelId}
            onChange={(event) => onModelChange(event.target.value as WhisperModelId)}
            disabled={isDisabled}
          >
            {WHISPER_MODELS.map((whisperModel) => (
              <option key={whisperModel.id} value={whisperModel.id}>
                {whisperModel.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 rounded-[10px] border border-[#d8e1dc] bg-[#eef5f0] px-3.5 py-3 text-xs text-[#4c6259]">
        <div className="flex flex-wrap gap-2 font-semibold text-[#1d6b50]">
          <span className="rounded-full bg-[#d8eade] px-2 py-1">精度：{model.accuracy}</span>
          <span className="rounded-full bg-[#d8eade] px-2 py-1">速度：{model.speed}</span>
          <span className="rounded-full bg-[#d8eade] px-2 py-1">容量：約{formatModelSize(model.totalSizeBytes)}</span>
        </div>
        <p className="mt-2 leading-relaxed">{model.description}</p>
        <p className="mt-1 text-[10px] text-[#71807b]">対応言語：{model.languageLabel}</p>
        {model.languageSupport === 'ja' ? (
          <p className="mt-1 text-[10px] text-[#9d604c]">
            日本語専用モデルのため、言語設定が自動判定でも日本語として実行します。
          </p>
        ) : null}
        <p className="mt-1 text-[10px] text-[#9aa6a1]">
          未ダウンロードの場合、文字起こし開始時に一度だけ取得します。
        </p>
      </div>
    </section>
  )
}
