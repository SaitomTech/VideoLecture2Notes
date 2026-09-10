import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import type { PerspectiveCorners, NormalizedPoint } from '../../../types/project'

export type QuadCorner = keyof PerspectiveCorners

const CORNERS: QuadCorner[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft']

const CORNER_LABELS: Record<QuadCorner, string> = {
  topLeft: '左上',
  topRight: '右上',
  bottomRight: '右下',
  bottomLeft: '左下',
}

const CORNER_ICON_POSITIONS: Record<QuadCorner, { left: string; top: string }> = {
  topLeft: { left: '18%', top: '22%' },
  topRight: { left: '82%', top: '22%' },
  bottomRight: { left: '82%', top: '78%' },
  bottomLeft: { left: '18%', top: '78%' },
}

export function CornerPositionIcon({
  corner,
  active = false,
}: {
  corner: QuadCorner
  active?: boolean
}) {
  const position = CORNER_ICON_POSITIONS[corner]
  return (
    <span
      className={`relative inline-block h-5 w-6 rounded-[3px] border ${active ? 'border-[#1d6b50] bg-[#d8eee2]' : 'border-[#9fb9ab] bg-[#f7fbf8]'}`}
      aria-hidden="true"
    >
      <span
        className={`absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${active ? 'bg-[#1d6b50]' : 'bg-[#7c9087]'}`}
        style={position}
      />
    </span>
  )
}

type QuadCropSelectorProps = {
  corners: PerspectiveCorners
  selectedCorner: QuadCorner
  onChange: (corners: PerspectiveCorners) => void
  onSelect: (corner: QuadCorner) => void
  disabled?: boolean
  visualScale?: number
}

function clamp(value: number) {
  return Math.min(Math.max(value, 0.005), 0.995)
}

function isConvex(corners: PerspectiveCorners) {
  const points = CORNERS.map((corner) => corners[corner])
  const signs = points.map((point, index) => {
    const next = points[(index + 1) % points.length]
    const after = points[(index + 2) % points.length]
    return (next.x - point.x) * (after.y - next.y) - (next.y - point.y) * (after.x - next.x)
  })
  return signs.every((sign) => sign > 0) || signs.every((sign) => sign < 0)
}

function moveCorner(corners: PerspectiveCorners, corner: QuadCorner, delta: NormalizedPoint) {
  const next = {
    ...corners,
    [corner]: {
      x: clamp(corners[corner].x + delta.x),
      y: clamp(corners[corner].y + delta.y),
    },
  }
  return isConvex(next) ? next : corners
}

function drawOverlay(canvas: HTMLCanvasElement, corners: PerspectiveCorners) {
  const bounds = canvas.getBoundingClientRect()
  const ratio = window.devicePixelRatio || 1
  const width = Math.max(1, Math.round(bounds.width * ratio))
  const height = Math.max(1, Math.round(bounds.height * ratio))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  const context = canvas.getContext('2d')
  if (!context) return
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.clearRect(0, 0, bounds.width, bounds.height)

  const points = CORNERS.map((corner) => ({
    x: corners[corner].x * bounds.width,
    y: corners[corner].y * bounds.height,
  }))

  context.fillStyle = 'rgba(4, 18, 13, 0.62)'
  context.fillRect(0, 0, bounds.width, bounds.height)
  context.globalCompositeOperation = 'destination-out'
  context.beginPath()
  points.forEach((point, index) =>
    index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y),
  )
  context.closePath()
  context.fill()
  context.globalCompositeOperation = 'source-over'

  context.strokeStyle = '#dcefe4'
  context.lineWidth = 2
  context.shadowColor = 'rgba(0, 0, 0, 0.35)'
  context.shadowBlur = 10
  context.beginPath()
  points.forEach((point, index) =>
    index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y),
  )
  context.closePath()
  context.stroke()
  context.shadowBlur = 0

  context.strokeStyle = 'rgba(220, 239, 228, 0.35)'
  context.lineWidth = 1
  for (let index = 1; index < 4; index += 1) {
    const ratio = index / 4
    const top = {
      x: points[0].x + (points[1].x - points[0].x) * ratio,
      y: points[0].y + (points[1].y - points[0].y) * ratio,
    }
    const bottom = {
      x: points[3].x + (points[2].x - points[3].x) * ratio,
      y: points[3].y + (points[2].y - points[3].y) * ratio,
    }
    const left = {
      x: points[0].x + (points[3].x - points[0].x) * ratio,
      y: points[0].y + (points[3].y - points[0].y) * ratio,
    }
    const right = {
      x: points[1].x + (points[2].x - points[1].x) * ratio,
      y: points[1].y + (points[2].y - points[1].y) * ratio,
    }
    context.beginPath()
    context.moveTo(top.x, top.y)
    context.lineTo(bottom.x, bottom.y)
    context.moveTo(left.x, left.y)
    context.lineTo(right.x, right.y)
    context.stroke()
  }
}

export function QuadCropSelector({
  corners,
  selectedCorner,
  onChange,
  onSelect,
  disabled = false,
  visualScale = 1,
}: QuadCropSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const interactionRef = useRef<{
    corner: QuadCorner
    corners: PerspectiveCorners
  } | null>(null)
  const onChangeRef = useRef(onChange)
  const [dragging, setDragging] = useState<QuadCorner | null>(null)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const redraw = useCallback(() => {
    if (canvasRef.current) drawOverlay(canvasRef.current, corners)
  }, [corners])

  useEffect(() => {
    redraw()
    const observer = new ResizeObserver(redraw)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [redraw])

  useEffect(() => {
    if (!dragging) return
    const move = (event: globalThis.PointerEvent) => {
      const interaction = interactionRef.current
      const bounds = containerRef.current?.getBoundingClientRect()
      if (!interaction || !bounds || bounds.width === 0 || bounds.height === 0) return
      const target = {
        x: clamp((event.clientX - bounds.left) / bounds.width),
        y: clamp((event.clientY - bounds.top) / bounds.height),
      }
      const next = moveCorner(interaction.corners, interaction.corner, {
        x: target.x - interaction.corners[interaction.corner].x,
        y: target.y - interaction.corners[interaction.corner].y,
      })
      onChangeRef.current(next)
    }
    const up = () => {
      interactionRef.current = null
      setDragging(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [dragging])

  const startDrag = (event: PointerEvent<HTMLButtonElement>, corner: QuadCorner) => {
    if (disabled || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    onSelect(corner)
    interactionRef.current = {
      corner,
      corners,
    }
    setDragging(corner)
  }

  const handleSize = 24 / Math.max(visualScale, 1)

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 touch-none select-none"
      aria-label="四隅で指定するスライド領域"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      {CORNERS.map((corner) => {
        const point = corners[corner]
        return (
          <button
            key={corner}
            type="button"
            className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-[0_2px_9px_rgba(0,0,0,0.38)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${selectedCorner === corner ? 'border-[#dcefe4] bg-[#1d6b50] ring-2 ring-[#1d6b50]/60' : 'border-[#1d6b50] bg-[#f3faf6]'} ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-crosshair hover:scale-110'}`}
            style={{
              left: `${point.x * 100}%`,
              top: `${point.y * 100}%`,
              width: `${handleSize}px`,
              height: `${handleSize}px`,
            }}
            aria-label={`${CORNER_LABELS[corner]}を調整`}
            onPointerDown={(event) => startDrag(event, corner)}
            onFocus={() => onSelect(corner)}
          >
            <span className="sr-only">{CORNER_LABELS[corner]}</span>
          </button>
        )
      })}
    </div>
  )
}

export { CORNERS, CORNER_LABELS }
