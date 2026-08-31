import { convertFileSrc } from '@tauri-apps/api/core'
import { ImageOff } from 'lucide-react'
import { useState } from 'react'
import type { SlideData } from '../../../types/project'

type SlideThumbnailProps = {
  slide: SlideData
}

export function SlideThumbnail({ slide }: SlideThumbnailProps) {
  const [hasError, setHasError] = useState(false)
  const imagePath = slide.image.representativeFramePath
  const imageSrc = imagePath && !hasError ? convertFileSrc(imagePath) : null

  return (
    <div className="aspect-video overflow-hidden rounded-[8px] border border-[#d8e1dc] bg-[#dce8e0]">
      {imageSrc ? (
        <img
          className="h-full w-full object-cover"
          src={imageSrc}
          alt={`Slide ${String(slide.index + 1).padStart(2, '0')}の代表フレーム`}
          loading="lazy"
          onError={() => setHasError(true)}
        />
      ) : (
        <div
          className="flex h-full items-center justify-center text-[#9aa6a1]"
          aria-label="代表フレームなし"
        >
          <ImageOff size={18} strokeWidth={1.5} />
        </div>
      )}
    </div>
  )
}
