import { drawStroke, type Stroke } from './strokes'

export const EXPORT_BG = '#09090b'

function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toString()
}

/** SVG path for one stroke, using the same midpoint-quadratic smoothing as
 * the canvas renderer so exports look identical to the live drawing. */
export function strokeToPathD(stroke: Stroke, w: number, h: number): string {
  const pts = stroke.points
  if (pts.length === 0) return ''
  const px = (i: number) => ({ x: pts[i].x * w, y: pts[i].y * h })
  const p0 = px(0)
  let d = `M ${fmt(p0.x)} ${fmt(p0.y)}`
  if (pts.length < 3) {
    for (let i = 1; i < pts.length; i++) {
      const p = px(i)
      d += ` L ${fmt(p.x)} ${fmt(p.y)}`
    }
    return d
  }
  for (let i = 1; i < pts.length - 1; i++) {
    const c = px(i)
    const n = px(i + 1)
    d += ` Q ${fmt(c.x)} ${fmt(c.y)} ${fmt((c.x + n.x) / 2)} ${fmt((c.y + n.y) / 2)}`
  }
  const last = px(pts.length - 1)
  d += ` L ${fmt(last.x)} ${fmt(last.y)}`
  return d
}

export function strokesToSvg(
  strokes: Stroke[],
  w: number,
  h: number,
  background: string | null = EXPORT_BG,
): string {
  const bg = background
    ? `<rect width="${w}" height="${h}" fill="${background}"/>`
    : ''
  const paths = strokes
    .filter((s) => s.points.length > 0)
    .map((s) => {
      if (s.points.length === 1) {
        const p = s.points[0]
        return `<circle cx="${fmt(p.x * w)}" cy="${fmt(p.y * h)}" r="${s.width / 2}" fill="${s.color}"/>`
      }
      return `<path d="${strokeToPathD(s, w, h)}" stroke="${s.color}" stroke-width="${s.width}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${bg}${paths}</svg>`
}

export function renderStrokesToPng(
  strokes: Stroke[],
  w: number,
  h: number,
  background: string = EXPORT_BG,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = background
  ctx.fillRect(0, 0, w, h)
  for (const s of strokes) drawStroke(ctx, s, w, h)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('PNG export failed'))
    }, 'image/png')
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
