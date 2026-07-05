// Generates the PWA icons (dark background, green air-stroke, amber fingertip)
// as PNGs without any image-library dependency. Run: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  // scanlines, each prefixed with filter byte 0
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function render(size) {
  const px = Buffer.alloc(size * size * 4)
  const bg = [0x09, 0x09, 0x0b] // zinc-950
  for (let i = 0; i < size * size; i++) {
    px[i * 4] = bg[0]
    px[i * 4 + 1] = bg[1]
    px[i * 4 + 2] = bg[2]
    px[i * 4 + 3] = 255
  }

  // blend a filled circle with a 1px antialiased edge
  function circle(cx, cy, r, [cr, cg, cb]) {
    const x0 = Math.max(0, Math.floor(cx - r - 2))
    const x1 = Math.min(size - 1, Math.ceil(cx + r + 2))
    const y0 = Math.max(0, Math.floor(cy - r - 2))
    const y1 = Math.min(size - 1, Math.ceil(cy + r + 2))
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, y - cy)
        const a = Math.min(1, Math.max(0, r - d + 0.5))
        if (a <= 0) continue
        const i = (y * size + x) * 4
        px[i] = px[i] * (1 - a) + cr * a
        px[i + 1] = px[i + 1] * (1 - a) + cg * a
        px[i + 2] = px[i + 2] * (1 - a) + cb * a
      }
    }
  }

  // quadratic bezier "air stroke" drawn as a brush
  const p0 = [0.2, 0.74]
  const p1 = [0.42, 0.12]
  const p2 = [0.76, 0.52]
  const green = [0x4a, 0xde, 0x80]
  for (let t = 0; t <= 1; t += 0.01) {
    const u = 1 - t
    const x = (u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0]) * size
    const y = (u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]) * size
    circle(x, y, size * 0.04, green)
  }
  // amber fingertip at the end of the stroke
  circle(p2[0] * size, p2[1] * size, size * 0.1, [0xfb, 0xbf, 0x24])
  circle(p2[0] * size, p2[1] * size, size * 0.045, [0xff, 0xff, 0xff])
  return px
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(join(outDir, name), encodePng(size, render(size)))
  console.log(`wrote public/icons/${name}`)
}
