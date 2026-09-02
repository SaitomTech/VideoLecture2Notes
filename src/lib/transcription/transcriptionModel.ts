import {
  DEFAULT_WHISPER_MODEL,
  getWhisperModel,
  WHISPER_MODELS,
  type WhisperModel,
  type WhisperModelId,
} from '../whisper/modelManager'

export const OPENAI_TRANSCRIBE_MODEL = {
  id: 'openai:gpt-transcribe',
  provider: 'openai',
  apiModel: 'gpt-transcribe',
  label: 'GPT-Transcribe（OpenAI API）',
  description:
    'OpenAIの音声認識モデルです。音声をSlideごとの区間（1区間は最大30分）に分け、送信用に圧縮してOpenAIへ送信します。',
  accuracy: '高',
  speed: '通信環境による',
} as const

export type OpenAiTranscriptionModel = typeof OPENAI_TRANSCRIBE_MODEL
export type LocalTranscriptionModel = {
  provider: 'local'
  id: WhisperModelId
  label: string
  model: WhisperModel
}
export type TranscriptionModel = LocalTranscriptionModel | OpenAiTranscriptionModel
export type TranscriptionModelId = WhisperModelId | OpenAiTranscriptionModel['id']

export const DEFAULT_TRANSCRIPTION_MODEL_ID: TranscriptionModelId = DEFAULT_WHISPER_MODEL.id

export const TRANSCRIPTION_MODELS: readonly TranscriptionModel[] = [
  ...WHISPER_MODELS.map((model) => ({
    provider: 'local' as const,
    id: model.id,
    label: model.label,
    model,
  })),
  OPENAI_TRANSCRIBE_MODEL,
]

export function getTranscriptionModel(id: string | undefined): TranscriptionModel {
  if (id === OPENAI_TRANSCRIBE_MODEL.id) return OPENAI_TRANSCRIBE_MODEL
  const model = getWhisperModel(id)
  return { provider: 'local', id: model.id, label: model.label, model }
}
