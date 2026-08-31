import type { SlideData, TranscriptionResult } from '../../types/project'

export type TranscriptionStage =
  | 'preparing-model'
  | 'extracting-audio'
  | 'transcribing'
  | 'assigning'
  | 'saving'
  | 'completed'

export type TranscriptionOutput = {
  result: TranscriptionResult
  slides: SlideData[]
}
