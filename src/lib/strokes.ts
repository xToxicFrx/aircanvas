import type { Point } from './pinch'

export interface Stroke {
  points: Point[]
  color: string
  width: number
}

export const INK_WIDTH = 6

export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  w: number,
  h: number,
) {
  const pts = stroke.points
  if (pts.length === 0) return
  ctx.strokeStyle = stroke.color
  ctx.lineWidth = stroke.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(pts[0].x * w, pts[0].y * h)
  if (pts.length < 3) {
    for (const p of pts.slice(1)) ctx.lineTo(p.x * w, p.y * h)
  } else {
    // midpoint quadratic curves: each point becomes a control point, the
    // curve passes through segment midpoints — renders simplified (sparse)
    // strokes smoothly instead of as angular polylines
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = ((pts[i].x + pts[i + 1].x) / 2) * w
      const my = ((pts[i].y + pts[i + 1].y) / 2) * h
      ctx.quadraticCurveTo(pts[i].x * w, pts[i].y * h, mx, my)
    }
    const last = pts[pts.length - 1]
    ctx.lineTo(last.x * w, last.y * h)
  }
  ctx.stroke()
}
