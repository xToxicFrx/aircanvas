import { describe, expect, it } from 'vitest'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import {
  INDEX_TIP,
  MIDDLE_MCP,
  nextPinchState,
  PINCH_OFF,
  PINCH_ON,
  pinchRatio,
  THUMB_TIP,
  WRIST,
} from '../pinch'

function makeLandmarks(overrides: Record<number, { x: number; y: number }>) {
  const lm: NormalizedLandmark[] = Array.from({ length: 21 }, () => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 1,
  }))
  for (const [i, p] of Object.entries(overrides)) {
    lm[Number(i)] = { ...lm[Number(i)], ...p }
  }
  return lm
}

describe('pinchRatio', () => {
  it('is scale-invariant: same hand pose at double distance gives same ratio', () => {
    const near = makeLandmarks({
      [WRIST]: { x: 0.5, y: 0.8 },
      [MIDDLE_MCP]: { x: 0.5, y: 0.6 },
      [THUMB_TIP]: { x: 0.45, y: 0.5 },
      [INDEX_TIP]: { x: 0.55, y: 0.5 },
    })
    // same pose, half the size (hand further from camera)
    const far = makeLandmarks({
      [WRIST]: { x: 0.5, y: 0.7 },
      [MIDDLE_MCP]: { x: 0.5, y: 0.6 },
      [THUMB_TIP]: { x: 0.475, y: 0.55 },
      [INDEX_TIP]: { x: 0.525, y: 0.55 },
    })
    expect(pinchRatio(near)).toBeCloseTo(pinchRatio(far), 10)
  })

  it('returns Infinity for degenerate zero-size hand instead of NaN', () => {
    expect(pinchRatio(makeLandmarks({}))).toBe(Infinity)
  })
})

describe('nextPinchState hysteresis', () => {
  it('engages only below the ON threshold', () => {
    expect(nextPinchState(false, PINCH_ON + 0.01)).toBe(false)
    expect(nextPinchState(false, PINCH_ON - 0.01)).toBe(true)
  })

  it('stays engaged in the dead zone between ON and OFF', () => {
    const deadZone = (PINCH_ON + PINCH_OFF) / 2
    expect(nextPinchState(true, deadZone)).toBe(true)
    // but never engages fresh from the dead zone
    expect(nextPinchState(false, deadZone)).toBe(false)
  })

  it('releases only above the OFF threshold', () => {
    expect(nextPinchState(true, PINCH_OFF - 0.01)).toBe(true)
    expect(nextPinchState(true, PINCH_OFF + 0.01)).toBe(false)
  })
})
