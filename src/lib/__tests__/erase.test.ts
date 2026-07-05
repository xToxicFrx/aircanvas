import { describe, expect, it } from 'vitest'
import { strokeHit } from '../erase'
import type { Stroke } from '../strokes'

const W = 1000
const H = 1000

function stroke(points: { x: number; y: number }[]): Stroke {
  return { points, color: '#fff', width: 6 }
}

describe('strokeHit', () => {
  const horizontal = stroke([
    { x: 0.1, y: 0.5 },
    { x: 0.9, y: 0.5 },
  ])

  it('hits when the point is within radius of a segment interior', () => {
    expect(strokeHit(horizontal, { x: 0.5, y: 0.51 }, 20, W, H)).toBe(true)
  })

  it('misses when the point is beyond the radius', () => {
    expect(strokeHit(horizontal, { x: 0.5, y: 0.55 }, 20, W, H)).toBe(false)
  })

  it('misses beyond the segment endpoints (no infinite-line hit)', () => {
    expect(strokeHit(horizontal, { x: 0.95, y: 0.5 }, 20, W, H)).toBe(false)
    expect(strokeHit(horizontal, { x: 0.93, y: 0.5 }, 40, W, H)).toBe(true)
  })

  it('handles single-point strokes as a dot', () => {
    const dot = stroke([{ x: 0.5, y: 0.5 }])
    expect(strokeHit(dot, { x: 0.51, y: 0.5 }, 20, W, H)).toBe(true)
    expect(strokeHit(dot, { x: 0.6, y: 0.5 }, 20, W, H)).toBe(false)
  })

  it('handles empty strokes', () => {
    expect(strokeHit(stroke([]), { x: 0.5, y: 0.5 }, 20, W, H)).toBe(false)
  })
})
