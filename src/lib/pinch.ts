import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

export const WRIST = 0
export const THUMB_TIP = 4
export const INDEX_TIP = 8
export const MIDDLE_MCP = 9

// Hysteresis thresholds for the pinch gesture, as a ratio of the
// thumb-tip↔index-tip distance to the palm length (wrist↔middle-MCP).
// Two thresholds prevent flicker when hovering right at the boundary:
// once pinched, the fingers must open clearly wider before the pen lifts.
export const PINCH_ON = 0.35
export const PINCH_OFF = 0.55

function dist(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Thumb–index distance normalized by palm length, so hand distance from the
 * camera doesn't change the gesture threshold. Infinity if palm size is 0. */
export function pinchRatio(lm: NormalizedLandmark[]): number {
  const palm = dist(lm[WRIST], lm[MIDDLE_MCP])
  if (palm === 0) return Infinity
  return dist(lm[THUMB_TIP], lm[INDEX_TIP]) / palm
}

export function nextPinchState(prevPinched: boolean, ratio: number): boolean {
  return prevPinched ? ratio < PINCH_OFF : ratio < PINCH_ON
}

export interface Point {
  x: number
  y: number
}

/** Pen position in *screen* space (video is CSS-mirrored, so x is flipped):
 * the midpoint between thumb and index tip, which stays much more stable
 * during a pinch than the index tip alone. */
export function penPoint(lm: NormalizedLandmark[]): Point {
  const x = (lm[THUMB_TIP].x + lm[INDEX_TIP].x) / 2
  const y = (lm[THUMB_TIP].y + lm[INDEX_TIP].y) / 2
  return { x: 1 - x, y }
}
