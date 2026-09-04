import { describe, expect, it } from 'vitest'
import { pixelIcons, storeIconRects } from './store-icon.ts'

describe('storeIconRects (Even store-icon rules)', () => {
  it('expands lookUp into even-aligned 2×2 rects inside 24×24', () => {
    const rects = storeIconRects(pixelIcons.lookUp)
    expect(rects.length).toBeGreaterThan(0)
    for (const r of rects) {
      expect(r.w).toBe(2)
      expect(r.h).toBe(2)
      expect(r.x % 2).toBe(0)
      expect(r.y % 2).toBe(0)
      expect(r.x + r.w).toBeLessThanOrEqual(24)
      expect(r.y + r.h).toBeLessThanOrEqual(24)
    }
  })

  it('keeps every glyph map on the 12×12 block budget', () => {
    for (const [name, rows] of Object.entries(pixelIcons)) {
      expect(rows.length, name).toBe(12)
      for (const row of rows) {
        expect(row.length, name).toBe(12)
        expect(/^[.#]+$/.test(row), name).toBe(true)
      }
      expect(() => storeIconRects(rows)).not.toThrow()
    }
  })
})
