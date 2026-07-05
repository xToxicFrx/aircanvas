import type { Point } from './pinch'

function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len
}

/**
 * Ramer-Douglas-Peucker: reduces a polyline to the fewest points that stay
 * within `epsilon` of the original shape. Points and epsilon must share the
 * same coordinate space (we call it in pixel space, since our normalized
 * coordinates have different scales on x and y).
 */
export function simplifyRdp(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points.slice()

  let maxDist = 0
  let maxIndex = 0
  const first = points[0]
  const last = points[points.length - 1]
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], first, last)
    if (d > maxDist) {
      maxDist = d
      maxIndex = i
    }
  }

  if (maxDist <= epsilon) return [first, last]

  const left = simplifyRdp(points.slice(0, maxIndex + 1), epsilon)
  const right = simplifyRdp(points.slice(maxIndex), epsilon)
  return left.slice(0, -1).concat(right)
}

/** Simplify a stroke stored in normalized 0..1 coordinates by mapping it to
 * pixel space (so distances are isotropic), running RDP there with a pixel
 * epsilon, and mapping back. */
export function simplifyStroke(
  points: Point[],
  width: number,
  height: number,
  epsilonPx = 2,
): Point[] {
  const px = points.map((p) => ({ x: p.x * width, y: p.y * height }))
  return simplifyRdp(px, epsilonPx).map((p) => ({ x: p.x / width, y: p.y / height }))
}
