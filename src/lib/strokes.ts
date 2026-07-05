import type { Point } from './pinch'

export interface Stroke {
  points: Point[]
  color: string
  width: number
}

export const INK_COLOR = '#fbbf24'
export const INK_WIDTH = 6

export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  w: number,
  h: number,
) {
  if (stroke.points.length === 0) return
  ctx.strokeStyle = stroke.color
  ctx.lineWidth = stroke.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(stroke.points[0].x * w, stroke.points[0].y * h)
  for (const p of stroke.points.slice(1)) {
    ctx.lineTo(p.x * w, p.y * h)
  }
  ctx.stroke()
}
