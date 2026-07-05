import type { Point } from './pinch'

class LowPass {
  private y: number | null = null

  filter(x: number, alpha: number): number {
    this.y = this.y === null ? x : alpha * x + (1 - alpha) * this.y
    return this.y
  }

  get last(): number | null {
    return this.y
  }

  reset() {
    this.y = null
  }
}

/**
 * One-Euro filter (Casiez et al. 2012) — the standard low-latency jitter
 * filter for noisy pointer input. At low speeds it smooths aggressively
 * (removes hand tremor), at high speeds the cutoff rises with velocity so
 * fast intentional movements come through without perceptible lag.
 */
export class OneEuroFilter {
  private xFilt = new LowPass()
  private dxFilt = new LowPass()
  private lastTimeMs: number | null = null

  constructor(
    private minCutoff = 1.2, // Hz; lower = smoother when still
    private beta = 0.02, // speed coefficient; higher = less lag when moving
    private dCutoff = 1.0,
  ) {}

  private alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff)
    return 1 / (1 + tau / dt)
  }

  filter(x: number, tMs: number): number {
    if (this.lastTimeMs === null) {
      this.lastTimeMs = tMs
      this.dxFilt.filter(0, 1)
      return this.xFilt.filter(x, 1)
    }
    const dt = Math.max((tMs - this.lastTimeMs) / 1000, 1e-6)
    this.lastTimeMs = tMs
    const dx = (x - this.xFilt.last!) / dt
    const edx = this.dxFilt.filter(dx, this.alpha(this.dCutoff, dt))
    const cutoff = this.minCutoff + this.beta * Math.abs(edx)
    return this.xFilt.filter(x, this.alpha(cutoff, dt))
  }

  reset() {
    this.xFilt.reset()
    this.dxFilt.reset()
    this.lastTimeMs = null
  }
}

/** One-Euro filter applied independently to x and y of a point. */
export class PointFilter {
  private fx: OneEuroFilter
  private fy: OneEuroFilter

  constructor(minCutoff?: number, beta?: number) {
    this.fx = new OneEuroFilter(minCutoff, beta)
    this.fy = new OneEuroFilter(minCutoff, beta)
  }

  filter(p: Point, tMs: number): Point {
    return { x: this.fx.filter(p.x, tMs), y: this.fy.filter(p.y, tMs) }
  }

  reset() {
    this.fx.reset()
    this.fy.reset()
  }
}
