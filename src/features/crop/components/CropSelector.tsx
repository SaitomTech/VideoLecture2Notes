import { useEffect, useRef, useState } from 'react'
import type { CropHandle, NormalizedCropRegion } from '../types'

const MINIMUM_SIZE = 0.06

type CropSelectorProps = {
  region: NormalizedCropRegion
  onChange: (region: NormalizedCropRegion) => void
}

type Interaction = {
  mode: 'move' | 'resize'
  handle?: CropHandle
  pointerX: number
  pointerY: number
  region: NormalizedCropRegion
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

function constrainRegion(region: NormalizedCropRegion): NormalizedCropRegion {
  const width = clamp(region.width, MINIMUM_SIZE, 1)
  const height = clamp(region.height, MINIMUM_SIZE, 1)

  return {
    width,
    height,
    x: clamp(region.x, 0, 1 - width),
    y: clamp(region.y, 0, 1 - height),
  }
}

function resizeRegion(
  region: NormalizedCropRegion,
  handle: CropHandle,
  deltaX: number,
  deltaY: number,
): NormalizedCropRegion {
  const right = region.x + region.width
  const bottom = region.y + region.height

  if (handle === 'north-west') {
    const x = clamp(region.x + deltaX, 0, right - MINIMUM_SIZE)
    const y = clamp(region.y + deltaY, 0, bottom - MINIMUM_SIZE)
    return constrainRegion({ x, y, width: right - x, height: bottom - y })
  }

  if (handle === 'north-east') {
    const y = clamp(region.y + deltaY, 0, bottom - MINIMUM_SIZE)
    const width = clamp(region.width + deltaX, MINIMUM_SIZE, 1 - region.x)
    return constrainRegion({ x: region.x, y, width, height: bottom - y })
  }

  if (handle === 'south-west') {
    const x = clamp(region.x + deltaX, 0, right - MINIMUM_SIZE)
    const height = clamp(region.height + deltaY, MINIMUM_SIZE, 1 - region.y)
    return constrainRegion({ x, y: region.y, width: right - x, height })
  }

  const width = clamp(region.width + deltaX, MINIMUM_SIZE, 1 - region.x)
  const height = clamp(region.height + deltaY, MINIMUM_SIZE, 1 - region.y)
  return constrainRegion({ x: region.x, y: region.y, width, height })
}

function nextRegion(interaction: Interaction, deltaX: number, deltaY: number) {
  if (interaction.mode === 'move') {
    return constrainRegion({
      ...interaction.region,
      x: interaction.region.x + deltaX,
      y: interaction.region.y + deltaY,
    })
  }

  return resizeRegion(interaction.region, interaction.handle!, deltaX, deltaY)
}

function percentage(value: number) {
  return `${value * 100}%`
}

const SHADE_CLASS = 'pointer-events-none absolute bg-[#07130e]/58'

export function CropSelector({ region, onChange }: CropSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const interactionRef = useRef<Interaction | null>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const [isInteracting, setIsInteracting] = useState(false)

  useEffect(() => {
    if (!isInteracting) return

    const move = (moveEvent: PointerEvent) => {
      const interaction = interactionRef.current
      const container = containerRef.current
      if (!interaction || !container) return

      const bounds = container.getBoundingClientRect()
      if (bounds.width === 0 || bounds.height === 0) return

      const deltaX = (moveEvent.clientX - interaction.pointerX) / bounds.width
      const deltaY = (moveEvent.clientY - interaction.pointerY) / bounds.height
      onChangeRef.current(nextRegion(interaction, deltaX, deltaY))
    }

    const up = () => {
      interactionRef.current = null
      setIsInteracting(false)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)

    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [isInteracting])

  useEffect(
    () => () => {
      interactionRef.current = null
    },
    [],
  )

  const startInteraction = (
    event: React.PointerEvent,
    mode: Interaction['mode'],
    handle?: CropHandle,
  ) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()

    interactionRef.current = {
      mode,
      handle,
      pointerX: event.clientX,
      pointerY: event.clientY,
      region,
    }

    setIsInteracting(true)
  }

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 overflow-hidden bg-transparent touch-none select-none"
      aria-label="動画のスライド領域"
    >
      <div className={SHADE_CLASS} style={{ inset: 0, height: percentage(region.y) }} />
      <div
        className={SHADE_CLASS}
        style={{
          top: percentage(region.y),
          bottom: percentage(1 - region.y - region.height),
          left: 0,
          width: percentage(region.x),
        }}
      />
      <div
        className={SHADE_CLASS}
        style={{
          top: percentage(region.y),
          bottom: percentage(1 - region.y - region.height),
          right: 0,
          width: percentage(1 - region.x - region.width),
        }}
      />
      <div
        className={SHADE_CLASS}
        style={{ left: 0, right: 0, bottom: 0, height: percentage(1 - region.y - region.height) }}
      />

      <div
        className="pointer-events-auto absolute cursor-move border-2 border-[#dcefe4] shadow-[0_0_0_1px_rgba(20,73,54,0.8),0_0_22px_rgba(0,0,0,0.2)]"
        style={{
          left: percentage(region.x),
          top: percentage(region.y),
          width: percentage(region.width),
          height: percentage(region.height),
        }}
        onPointerDown={(event) => startInteraction(event, 'move')}
        role="group"
        aria-label="選択中の領域。ドラッグして移動"
      >
        {(['north-west', 'north-east', 'south-west', 'south-east'] as const).map((handle) => (
          <button
            className={`absolute h-3.5 w-3.5 rounded-sm border border-[#174d3c] bg-[#f3faf6] shadow-[0_1px_5px_rgba(0,0,0,0.24)] ${handle === 'north-west' ? '-left-2 -top-2 cursor-nwse-resize' : ''} ${handle === 'north-east' ? '-right-2 -top-2 cursor-nesw-resize' : ''} ${handle === 'south-west' ? '-bottom-2 -left-2 cursor-nesw-resize' : ''} ${handle === 'south-east' ? '-bottom-2 -right-2 cursor-nwse-resize' : ''}`}
            key={handle}
            type="button"
            aria-label={`${handle}からサイズ変更`}
            onPointerDown={(event) => startInteraction(event, 'resize', handle)}
          />
        ))}
      </div>
    </div>
  )
}
