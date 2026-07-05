import { describe, expect, it } from 'vitest'
import { strokesToSvg, strokeToPathD } from '../export'
import type { Stroke } from '../strokes'

function stroke(points: { x: number; y: number }[], color = '#fbbf24'): Stroke {
  return { points, color, width: 6 }
}

describe('strokeToPathD', () => {
  it('returns empty string for empty stroke', () => {
    expect(strokeToPathD(stroke([]), 100, 100)).toBe('')
  })

  it('renders two points as a straight line', () => {
    const d = strokeToPathD(
      stroke([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]),
      100,
      200,
    )
    expect(d).toBe('M 0 0 L 100 200')
  })

  it('uses midpoint quadratics for 3+ points (same as canvas renderer)', () => {
    const d = strokeToPathD(
      stroke([
        { x: 0, y: 0 },
        { x: 0.5, y: 0.5 },
        { x: 1, y: 0 },
      ]),
      100,
      100,
    )
    // control point = middle point, curve target = midpoint(middle, last)
    expect(d).toBe('M 0 0 Q 50 50 75 25 L 100 0')
  })
})

describe('strokesToSvg', () => {
  it('produces a valid svg root with viewBox and background', () => {
    const svg = strokesToSvg([], 1280, 720)
    expect(svg).toContain('viewBox="0 0 1280 720"')
    expect(svg).toContain('<rect width="1280" height="720"')
  })

  it('omits the background when null', () => {
    expect(strokesToSvg([], 100, 100, null)).not.toContain('<rect')
  })

  it('renders one path per multi-point stroke with its color', () => {
    const svg = strokesToSvg(
      [
        stroke([{ x: 0, y: 0 }, { x: 1, y: 1 }], '#34d399'),
        stroke([{ x: 0, y: 1 }, { x: 1, y: 0 }], '#38bdf8'),
      ],
      100,
      100,
    )
    expect(svg.match(/<path /g)).toHaveLength(2)
    expect(svg).toContain('stroke="#34d399"')
    expect(svg).toContain('stroke="#38bdf8"')
  })

  it('renders single-point strokes as dots', () => {
    const svg = strokesToSvg([stroke([{ x: 0.5, y: 0.5 }])], 100, 100)
    expect(svg).toContain('<circle cx="50" cy="50" r="3"')
  })

  it('skips empty strokes entirely', () => {
    const svg = strokesToSvg([stroke([])], 100, 100)
    expect(svg).not.toContain('<path')
    expect(svg).not.toContain('<circle')
  })
})
