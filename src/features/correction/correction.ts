import type { CorrectionLevel } from '../../types/project'

export const CORRECTION_LEVELS = [
  {
    id: 'lv1',
    label: 'Lv.1',
    description: '単語の置換と、日本語の軽い調整だけを行います。',
  },
  {
    id: 'lv2',
    label: 'Lv.2',
    description: 'スライドの用語・表記を優先して、文を軽く整えます。',
  },
  {
    id: 'lv3',
    label: 'Lv.3',
    description: '欠落した短い用語を補い、スライドに沿って文章を整えます。',
  },
  {
    id: 'lv4',
    label: 'Lv.4',
    description: 'スライドを基準に、文単位の再構成まで行います。',
  },
  {
    id: 'lv5',
    label: 'Lv.5',
    description: 'スライドを正として、本文をスライド中心に書き直します。',
  },
] as const satisfies ReadonlyArray<{ id: CorrectionLevel; label: string; description: string }>

export const DEFAULT_CORRECTION_LEVEL: CorrectionLevel = 'lv1'
