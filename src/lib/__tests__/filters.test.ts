import { describe, expect, it } from 'vitest'
import { OneEuroFilter, PointFilter } from '../filters'

describe('OneEuroFilter', () => {
  it('passes a constant signal through unchanged', () => {
    const f = new OneEuroFilter()
    let out = 0
    for (let t = 0; t < 100; t++) out = f.filter(5, t * 16)
    expect(out).toBeCloseTo(5, 6)
  })

  it('attenuates high-frequency jitter around a constant position', () => {
    const f = new OneEuroFilter()
    const noisy: number[] = []
    const filtered: number[] = []
    for (let t = 0; t < 200; t++) {
      const jitter = (t % 2 === 0 ? 1 : -1) * 0.05 // ±0.05 alternating
      noisy.push(0.5 + jitter)
      filtered.push(f.filter(0.5 + jitter, t * 16))
    }
    const amplitude = (xs: number[]) =>
      Math.max(...xs.slice(100)) - Math.min(...xs.slice(100))
    expect(amplitude(filtered)).toBeLessThan(amplitude(noisy) / 5)
  })

  it('converges to a step input (no permanent lag)', () => {
    const f = new OneEuroFilter()
    f.filter(0, 0)
    let out = 0
    for (let t = 1; t < 300; t++) out = f.filter(1, t * 16)
    expect(out).toBeCloseTo(1, 2)
  })

  it('reset() forgets history', () => {
    const f = new OneEuroFilter()
    f.filter(100, 0)
    f.filter(100, 16)
    f.reset()
    expect(f.filter(3, 1000)).toBe(3)
  })
})

describe('PointFilter', () => {
  it('filters x and y independently', () => {
    const f = new PointFilter()
    let p = { x: 0, y: 0 }
    for (let t = 0; t < 100; t++) p = f.filter({ x: 2, y: 7 }, t * 16)
    expect(p.x).toBeCloseTo(2, 6)
    expect(p.y).toBeCloseTo(7, 6)
  })
})
