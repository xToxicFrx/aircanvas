import type { Point } from './pinch'
import type { Stroke } from './strokes'

function segmentDistance(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const len2 = abx * abx + aby * aby
  let t = len2 === 0 ? 0 : ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby))
}

/** True if the eraser point (normalized coords) comes within radiusPx of any
 * segment of the stroke. Computed in pixel space for isotropic distances. */
export function strokeHit(
  stroke: Stroke,
  point: Point,
  radiusPx: number,
  w: number,
  h: number,
): boolean {
  const p = { x: point.x * w, y: point.y * h }
  const pts = stroke.points
  if (pts.length === 0) return false
  if (pts.length === 1) {
    return Math.hypot(p.x - pts[0].x * w, p.y - pts[0].y * h) <= radiusPx
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = { x: pts[i].x * w, y: pts[i].y * h }
    const b = { x: pts[i + 1].x * w, y: pts[i + 1].y * h }
    if (segmentDistance(p, a, b) <= radiusPx) return true
  }
  return false
}
