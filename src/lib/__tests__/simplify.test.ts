import { describe, expect, it } from 'vitest'
import { simplifyRdp, simplifyStroke } from '../simplify'

describe('simplifyRdp', () => {
  it('collapses collinear points to just the endpoints', () => {
    const line = Array.from({ length: 100 }, (_, i) => ({ x: i, y: i * 2 }))
    expect(simplifyRdp(line, 0.5)).toEqual([line[0], line[99]])
  })

  it('preserves a spike that exceeds epsilon', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 5, y: 10 },
      { x: 10, y: 0 },
    ]
    expect(simplifyRdp(points, 1)).toEqual(points)
  })

  it('removes a bump smaller than epsilon', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 5, y: 0.5 },
      { x: 10, y: 0 },
    ]
    expect(simplifyRdp(points, 1)).toEqual([points[0], points[2]])
  })

  it('keeps first and last point always', () => {
    const noisy = Array.from({ length: 50 }, (_, i) => ({
      x: i,
      y: Math.sin(i / 3) * 5,
    }))
    const simplified = simplifyRdp(noisy, 0.8)
    expect(simplified[0]).toEqual(noisy[0])
    expect(simplified[simplified.length - 1]).toEqual(noisy[49])
    expect(simplified.length).toBeLessThan(noisy.length)
  })

  it('passes through inputs of length <= 2 unchanged', () => {
    expect(simplifyRdp([], 1)).toEqual([])
    const two = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]
    expect(simplifyRdp(two, 1)).toEqual(two)
  })
})

describe('simplifyStroke', () => {
  it('treats epsilon isotropically despite non-square canvases', () => {
    // horizontal wobble of 3px on a 1280x720 canvas: normalized amplitude is
    // tiny on x (3/1280) — a naive normalized-space RDP with a y-tuned epsilon
    // would misjudge it. In pixel space it must survive an epsilon of 2px.
    const stroke = [
      { x: 0.1, y: 0.5 },
      { x: 0.1 + 3 / 1280, y: 0.6 },
      { x: 0.1, y: 0.7 },
    ]
    const kept = simplifyStroke(stroke, 1280, 720, 2)
    expect(kept).toHaveLength(3)
  })

  it('returns normalized coordinates in 0..1', () => {
    const stroke = Array.from({ length: 20 }, (_, i) => ({
      x: i / 20,
      y: 0.5 + Math.sin(i) * 0.01,
    }))
    for (const p of simplifyStroke(stroke, 1280, 720, 2)) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(1)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeLessThanOrEqual(1)
    }
  })
})
