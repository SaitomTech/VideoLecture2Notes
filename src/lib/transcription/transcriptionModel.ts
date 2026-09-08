import { DEFAULT_WHISPER_MODEL, getWhisperModel, type WhisperModel } from '../whisper/modelManager'

export const OPENAI_TRANSCRIBE_MODEL = {
  id: 'openai:gpt-transcribe',
  provider: 'openai',
  apiModel: 'gpt-transcribe',
  label: 'GPT-Transcribe',
  description:
    'OpenAIの音声認識モデルです。音声をスライド境界で分け、25MBを超える区間だけ追加分割します。現在と前後スライドのOCR用語をコンテキストとして添え、最大8件ずつ並列処理します。',
  accuracy: '高',
  speed: '通信環境による',
} as const

export const APPLE_SPEECH_TRANSCRIBER_MODEL = {
  id: 'apple:speech-transcriber',
  provider: 'apple',
  label: 'Apple SpeechTranscriber',
  description: 'macOS標準のオンデバイス音声認識です。講義や長時間の音声をMac内で処理します。',
} as const

export type OpenAiTranscriptionModel = typeof OPENAI_TRANSCRIBE_MODEL
export type AppleSpeechTranscriptionModel = typeof APPLE_SPEECH_TRANSCRIBER_MODEL
const TRANSCRIPTION_LOCAL_MODEL_DEFINITIONS = [
  {
    id: 'tiny-q5_1',
    label: 'Whisper tiny Q5_1（動作確認用）',
  },
  {
    id: 'large-v3-turbo-q5_0',
    label: 'Whisper large-v3-turbo Q5_0（標準）',
  },
  {
    id: 'large-v3',
    label: 'Whisper large-v3（高精度）',
  },
] as const

export type TranscriptionLocalModelId = (typeof TRANSCRIPTION_LOCAL_MODEL_DEFINITIONS)[number]['id']
export type LocalTranscriptionModel = {
  provider: 'local'
  id: TranscriptionLocalModelId
  label: string
  model: WhisperModel
}
export type TranscriptionModel =
  | LocalTranscriptionModel
  | OpenAiTranscriptionModel
  | AppleSpeechTranscriptionModel
export type TranscriptionModelId =
  | TranscriptionLocalModelId
  | OpenAiTranscriptionModel['id']
  | AppleSpeechTranscriptionModel['id']

export const TRANSCRIPTION_LOCAL_MODELS: readonly LocalTranscriptionModel[] =
  TRANSCRIPTION_LOCAL_MODEL_DEFINITIONS.map(({ id, label }) => ({
    provider: 'local' as const,
    id,
    label,
    model: getWhisperModel(id),
  }))

const DEFAULT_LOCAL_TRANSCRIPTION_MODEL =
  TRANSCRIPTION_LOCAL_MODELS.find((model) => model.id === DEFAULT_WHISPER_MODEL.id) ??
  TRANSCRIPTION_LOCAL_MODELS[0]

export const DEFAULT_TRANSCRIPTION_MODEL_ID: TranscriptionModelId =
  APPLE_SPEECH_TRANSCRIBER_MODEL.id

export const TRANSCRIPTION_MODELS: readonly TranscriptionModel[] = [
  APPLE_SPEECH_TRANSCRIBER_MODEL,
  ...TRANSCRIPTION_LOCAL_MODELS,
  OPENAI_TRANSCRIBE_MODEL,
]

export function getTranscriptionModel(id: string | undefined): TranscriptionModel {
  if (id === undefined) return APPLE_SPEECH_TRANSCRIBER_MODEL
  if (id === OPENAI_TRANSCRIBE_MODEL.id) return OPENAI_TRANSCRIBE_MODEL
  if (id === APPLE_SPEECH_TRANSCRIBER_MODEL.id) return APPLE_SPEECH_TRANSCRIBER_MODEL
  return (
    TRANSCRIPTION_LOCAL_MODELS.find((model) => model.id === id) ?? DEFAULT_LOCAL_TRANSCRIPTION_MODEL
  )
}
