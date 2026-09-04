import { describe, expect, it } from 'vitest'
import { getTextWidth } from '@evenrealities/pretext'
import {
  GLASSES_H,
  GLASSES_LINE_HEIGHT_PX,
  GLASSES_PADDING_LENGTH,
  GLASSES_W,
  contentInset,
  contentWidth,
  wrapByPixels,
} from './glasses-layout.ts'

describe('glasses layout (Hub display SoT)', () => {
  it('matches G2 canvas and firmware line height', () => {
    expect(GLASSES_W).toBe(576)
    expect(GLASSES_H).toBe(288)
    expect(GLASSES_LINE_HEIGHT_PX).toBe(27)
    expect(GLASSES_PADDING_LENGTH).toBe(4)
  })

  it('content box subtracts border + padding on both sides', () => {
    expect(contentInset(1, 4)).toBe(5)
    expect(contentWidth(576, 1, 4)).toBe(566)
    expect(contentWidth(576, 0, 0)).toBe(576)
  })

  it('wrapByPixels uses pretext glyph metrics (not monospace columns)', () => {
    const max = 80
    const lines = wrapByPixels('Hello, HUDeck preview wrap check', max)
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) {
      expect(getTextWidth(line)).toBeLessThanOrEqual(max)
    }
  })

  it('honours explicit newlines', () => {
    expect(wrapByPixels('> Record\n> Chat', 500)).toEqual(['> Record', '> Chat'])
  })
})
