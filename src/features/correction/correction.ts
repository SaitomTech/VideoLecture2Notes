import type { CorrectionLevel } from '../../types/project'

export const CORRECTION_LEVELS = [
  {
    id: 'lv1',
    label: 'Lv.1',
    description: '発話の文体・構造を保ち、表記と日本語だけを最小限に整えます。',
  },
  {
    id: 'lv2',
    label: 'Lv.2',
    description: '発話の文体・意味を保ち、フィラーや重複を整理して読みやすくします。',
  },
  {
    id: 'lv3',
    label: 'Lv.3',
    description: '発話の文体を保ち、スライドを基準に対応する説明文へ再構成します。',
  },
] as const satisfies ReadonlyArray<{ id: CorrectionLevel; label: string; description: string }>

export const DEFAULT_CORRECTION_LEVEL: CorrectionLevel = 'lv1'
