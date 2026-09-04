import { describe, expect, it } from 'vitest'
import {
  DOT_PITCH,
  RASTER_SCALE,
  inkCss,
  plannedDeckView,
  sampleDotsFromCoverage,
} from './glasses-preview.ts'

describe('dot-matrix preview helpers', () => {
  it('uses a 3px pitch so LED dots match Even Hub companion spacing', () => {
    expect(DOT_PITCH).toBe(3)
  })

  it('supersamples before max-pool for solid strokes', () => {
    expect(RASTER_SCALE).toBeGreaterThanOrEqual(2)
  })

  it('plannedDeckView is the idle lookUp chrome used as ghost', () => {
    const v = plannedDeckView()
    expect(v.kind).toBe('deck')
    expect(v.title).toContain('HUDeck')
    expect(v.body).toContain('Record')
  })

  it('inkCss lightens toward white as intensity drops', () => {
    expect(inkCss(0, 1)).toBe('rgb(0,0,0)')
    expect(inkCss(0, 0)).toBe('rgb(255,255,255)')
  })

  it('samples coverage into active vs ghost dots on pitch grid', () => {
    const w = 6
    const h = 6
    const active = new Float32Array(w * h)
    const ghost = new Float32Array(w * h)
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) active[y * w + x] = 1
    }
    ghost.fill(1)
    const dots = sampleDotsFromCoverage({
      width: w,
      height: h,
      active,
      ghost,
      pitch: 3,
    })
    expect(dots.some((d) => d.kind === 'active')).toBe(true)
    expect(dots.some((d) => d.kind === 'ghost')).toBe(true)
    for (const d of dots) {
      expect(d.x % 3).toBe(0)
      expect(d.y % 3).toBe(0)
    }
  })
})
