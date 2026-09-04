import { describe, expect, it } from 'vitest'
import {
  DOT_PITCH,
  plannedDeckView,
  sampleDotsFromCoverage,
} from './glasses-preview.ts'

describe('dot-matrix preview helpers', () => {
  it('uses a 2px pitch so strokes stay on the G2 pixel grid', () => {
    expect(DOT_PITCH).toBe(2)
  })

  it('plannedDeckView is the idle lookUp chrome used as ghost', () => {
    const v = plannedDeckView()
    expect(v.kind).toBe('deck')
    expect(v.title).toContain('HUDeck')
    expect(v.body).toContain('Record')
  })

  it('samples coverage into active vs ghost dots', () => {
    // 4×4 coverage: top-left bright, rest dim ghost
    const w = 4
    const h = 4
    const active = new Float32Array(w * h)
    const ghost = new Float32Array(w * h)
    active[0] = 1
    active[1] = 0.8
    ghost[0] = 1
    ghost[1] = 1
    ghost[2] = 1
    ghost[3] = 1
    const dots = sampleDotsFromCoverage({
      width: w,
      height: h,
      active,
      ghost,
      pitch: 2,
    })
    expect(dots.some((d) => d.kind === 'active')).toBe(true)
    expect(dots.some((d) => d.kind === 'ghost')).toBe(true)
    for (const d of dots) {
      expect(d.x % 2).toBe(0)
      expect(d.y % 2).toBe(0)
    }
  })
})
