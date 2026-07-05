import { describe, expect, it } from 'vitest'
import { DiagramSchema, diagramToSvg, stripCodeFences } from '../cleanup'

const validDiagram = {
  shapes: [
    { id: 'a', type: 'rect', x: 0.1, y: 0.1, w: 0.2, h: 0.1, label: 'Start' },
    { id: 'b', type: 'diamond', x: 0.5, y: 0.1, w: 0.2, h: 0.15, label: 'OK?' },
    { id: 'c', type: 'ellipse', x: 0.5, y: 0.5, w: 0.2, h: 0.1, label: '' },
  ],
  arrows: [
    { from: 'a', to: 'b', label: 'weiter' },
    { from: 'b', to: 'c', label: '' },
  ],
}

describe('DiagramSchema', () => {
  it('accepts a valid diagram', () => {
    expect(DiagramSchema.safeParse(validDiagram).success).toBe(true)
  })

  it('defaults missing arrows/labels', () => {
    const parsed = DiagramSchema.parse({
      shapes: [{ id: 'a', type: 'rect', x: 0, y: 0, w: 0.5, h: 0.5 }],
    })
    expect(parsed.arrows).toEqual([])
    expect(parsed.shapes[0].label).toBe('')
  })

  it('rejects unknown shape types', () => {
    const bad = {
      shapes: [{ id: 'a', type: 'triangle', x: 0, y: 0, w: 0.5, h: 0.5 }],
    }
    expect(DiagramSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects out-of-range coordinates and zero sizes', () => {
    expect(
      DiagramSchema.safeParse({
        shapes: [{ id: 'a', type: 'rect', x: 1.5, y: 0, w: 0.5, h: 0.5 }],
      }).success,
    ).toBe(false)
    expect(
      DiagramSchema.safeParse({
        shapes: [{ id: 'a', type: 'rect', x: 0, y: 0, w: 0, h: 0.5 }],
      }).success,
    ).toBe(false)
  })

  it('rejects an empty shape list', () => {
    expect(DiagramSchema.safeParse({ shapes: [] }).success).toBe(false)
  })
})

describe('stripCodeFences', () => {
  it('removes ```json fences', () => {
    expect(stripCodeFences('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('removes plain ``` fences', () => {
    expect(stripCodeFences('```\n<html></html>\n```')).toBe('<html></html>')
  })

  it('leaves unfenced content untouched', () => {
    expect(stripCodeFences('{"a":1}')).toBe('{"a":1}')
  })

  it('does not eat fences that only appear mid-string', () => {
    const s = 'before\n```\ncode\n```'
    expect(stripCodeFences(s)).toBe(s)
  })
})

describe('diagramToSvg', () => {
  const diagram = DiagramSchema.parse(validDiagram)

  it('renders every shape and arrow', () => {
    const svg = diagramToSvg(diagram)
    expect(svg).toContain('<rect x=')
    expect(svg).toContain('<polygon')
    expect(svg).toContain('<ellipse')
    expect(svg.match(/<line /g)).toHaveLength(2)
  })

  it('renders labels and escapes XML entities', () => {
    const withSpecial = DiagramSchema.parse({
      shapes: [
        { id: 'a', type: 'rect', x: 0.1, y: 0.1, w: 0.3, h: 0.2, label: 'a < b & c' },
      ],
    })
    const svg = diagramToSvg(withSpecial)
    expect(svg).toContain('a &lt; b &amp; c')
  })

  it('drops arrows that reference unknown shapes', () => {
    const withBadArrow = DiagramSchema.parse({
      shapes: [{ id: 'a', type: 'rect', x: 0.1, y: 0.1, w: 0.3, h: 0.2 }],
      arrows: [{ from: 'a', to: 'ghost' }],
    })
    expect(diagramToSvg(withBadArrow)).not.toContain('<line')
  })
})
