import { z } from 'zod'

// ---------- shared types & validation (used by the API route and the client) ----------

export const DiagramShapeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['rect', 'ellipse', 'diamond']),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().gt(0).max(1),
  h: z.number().gt(0).max(1),
  label: z.string().default(''),
})

export const DiagramArrowSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().default(''),
})

export const DiagramSchema = z.object({
  shapes: z.array(DiagramShapeSchema).min(1).max(40),
  arrows: z.array(DiagramArrowSchema).max(60).default([]),
})

export type Diagram = z.infer<typeof DiagramSchema>
export type DiagramShape = z.infer<typeof DiagramShapeSchema>

export type CleanupMode = 'diagram' | 'ui'

export interface CleanupRequest {
  mode: CleanupMode
  /** PNG data URL of the sketch */
  image: string
}

export type CleanupResponse =
  | { ok: true; mode: 'diagram'; diagram: Diagram }
  | { ok: true; mode: 'ui'; html: string }
  | { ok: false; error: string }

// ---------- prompt building ----------

export const DIAGRAM_SYSTEM_PROMPT = `You convert a hand-drawn sketch (drawn in the air with a finger, so it is rough and wobbly) into a clean structured diagram.

Respond with ONLY a JSON object of this exact shape:
{
  "shapes": [{ "id": "a", "type": "rect" | "ellipse" | "diamond", "x": 0.1, "y": 0.1, "w": 0.25, "h": 0.12, "label": "text inside the shape" }],
  "arrows": [{ "from": "a", "to": "b", "label": "" }]
}

Rules:
- x, y, w, h are fractions of the canvas (0..1); x,y is the shape's top-left corner.
- Interpret wobbly boxes as "rect", circles/ovals as "ellipse", rotated squares as "diamond".
- Straighten and align: snap shapes to a tidy layout that preserves the sketch's arrangement.
- Lines between shapes become arrows (direction from the stroke's start to its end if arrowheads are unclear).
- Scribbled text becomes short labels; if unreadable, use an empty string.
- Every arrow's "from"/"to" must reference an existing shape id.`

export const UI_SYSTEM_PROMPT = `You convert a hand-drawn UI wireframe sketch (drawn in the air with a finger, so it is rough and wobbly) into clean, modern HTML with embedded CSS.

Respond with ONLY a complete HTML document (<!doctype html> ... </html>). No markdown fences, no explanations.

Rules:
- Interpret boxes as containers/cards/buttons/inputs based on their shape, position and any scribbled labels.
- Produce a polished, responsive layout (flexbox/grid), light theme, system font stack.
- All CSS inline in a <style> tag; no external resources, no JavaScript.
- Use realistic placeholder text where labels are unreadable.`

// ---------- response post-processing ----------

/** Strips markdown code fences that models sometimes wrap around output. */
export function stripCodeFences(s: string): string {
  const trimmed = s.trim()
  const match = trimmed.match(/^```[a-zA-Z]*\r?\n([\s\S]*?)\r?\n?```$/)
  return match ? match[1].trim() : trimmed
}

// ---------- clean diagram rendering (client side) ----------

const DIAGRAM_W = 800
const DIAGRAM_H = 450

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function shapeSvg(s: DiagramShape): string {
  const x = s.x * DIAGRAM_W
  const y = s.y * DIAGRAM_H
  const w = s.w * DIAGRAM_W
  const h = s.h * DIAGRAM_H
  const style = 'fill="#ffffff" stroke="#27272a" stroke-width="2"'
  let shape: string
  if (s.type === 'ellipse') {
    shape = `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" ${style}/>`
  } else if (s.type === 'diamond') {
    const pts = `${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`
    shape = `<polygon points="${pts}" ${style}/>`
  } else {
    shape = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" ${style}/>`
  }
  const label = s.label
    ? `<text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif" font-size="14" fill="#18181b">${escapeXml(s.label)}</text>`
    : ''
  return shape + label
}

/** Renders the validated diagram JSON as a tidy light-theme SVG. Arrows whose
 * endpoints don't resolve to a shape are dropped defensively. */
export function diagramToSvg(diagram: Diagram): string {
  const byId = new Map(diagram.shapes.map((s) => [s.id, s]))
  const shapes = diagram.shapes.map(shapeSvg).join('')
  const arrows = diagram.arrows
    .filter((a) => byId.has(a.from) && byId.has(a.to))
    .map((a) => {
      const f = byId.get(a.from)!
      const t = byId.get(a.to)!
      const x1 = (f.x + f.w / 2) * DIAGRAM_W
      const y1 = (f.y + f.h / 2) * DIAGRAM_H
      const x2 = (t.x + t.w / 2) * DIAGRAM_W
      const y2 = (t.y + t.h / 2) * DIAGRAM_H
      const label = a.label
        ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 6}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" fill="#52525b">${escapeXml(a.label)}</text>`
        : ''
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#52525b" stroke-width="1.5" marker-end="url(#arrowhead)"/>${label}`
    })
    .join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${DIAGRAM_W} ${DIAGRAM_H}" width="${DIAGRAM_W}" height="${DIAGRAM_H}">` +
    `<defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#52525b"/></marker></defs>` +
    `<rect width="${DIAGRAM_W}" height="${DIAGRAM_H}" fill="#fafafa"/>` +
    arrows +
    shapes +
    `</svg>`
  )
}
