import { TEXT_MODELS, type TextModelId } from '../../../lib/llama/textModel'

type TextModelSelectorProps = {
  value: TextModelId
  disabled?: boolean
  onChange: (modelId: TextModelId) => void
}

function formatModelSize(bytes: number) {
  return `${(bytes / 1024 ** 3).toFixed(2)}GB`
}

export function TextModelSelector({ value, disabled = false, onChange }: TextModelSelectorProps) {
  return (
    <section className="mb-8 border-b border-[#e0e8e3] pb-6" aria-labelledby="text-model-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="text-model-heading" className="text-[21px] font-bold tracking-[-0.05em]">
            文章処理モデル
          </h2>
          <p className="mt-1 text-xs text-[#71807b]">文字起こしの補正と記事本文の生成で共通して使用します。</p>
        </div>
        <label className="flex items-center gap-3 text-xs font-semibold text-[#71807b]" htmlFor="text-model">
          モデル
          <select
            id="text-model"
            className="rounded-[8px] border border-[#b7cbc0] bg-[#fbfcfa] px-3 py-2 text-sm font-normal text-[#18211f] outline-none focus:border-[#1d6b50] focus:ring-2 focus:ring-[#1d6b50]/20 disabled:cursor-not-allowed disabled:opacity-50"
            value={value}
            onChange={(event) => onChange(event.target.value as TextModelId)}
            disabled={disabled}
          >
            {TEXT_MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-3 font-mono text-[10px] text-[#9aa6a1]">
        選択したモデルは必要になった時点でダウンロードします（約
        {formatModelSize(TEXT_MODELS.find((model) => model.id === value)?.totalSizeBytes ?? 0)}）。
      </p>
    </section>
  )
}
