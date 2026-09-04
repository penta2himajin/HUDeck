import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PREVIEW_INTENSITY,
  PREVIEW_ASPECT,
  PREVIEW_BG,
  PREVIEW_BG_LEVEL,
  PREVIEW_BORDER_RADIUS,
  PREVIEW_FONT_PX,
  PREVIEW_PAD_PX,
  TITLE_BAND_H,
  coverageInkByte,
  drawBandBorder,
  inkCss,
  plannedDeckView,
  previewLayout,
} from './glasses-preview.ts'
import { GLASSES_LINE_HEIGHT_PX, contentInset, contentWidth } from './glasses-layout.ts'
import { FRAME_BORDER_RADIUS } from './hub-page.ts'

describe('smooth greyscale preview', () => {
  it('uses 25px preview pad and G2 2:1 aspect', () => {
    expect(DEFAULT_PREVIEW_INTENSITY).toBe(0.55)
    expect(PREVIEW_PAD_PX).toBe(25)
    expect(PREVIEW_ASPECT).toBe(2)
  })

  it('uses firmware line height, mild Hub borderRadius, and ~14px body size', () => {
    expect(GLASSES_LINE_HEIGHT_PX).toBe(27)
    expect(PREVIEW_FONT_PX).toBe(14)
    expect(TITLE_BAND_H).toBe(36)
    expect(PREVIEW_BORDER_RADIUS).toBe(6)
    expect(FRAME_BORDER_RADIUS).toBe(PREVIEW_BORDER_RADIUS)
  })

  it('plannedDeckView is the idle lookUp chrome used as ghost', () => {
    const v = plannedDeckView()
    expect(v.kind).toBe('deck')
    expect(v.title).toContain('HUDeck')
    expect(v.body).toContain('Record')
  })

  it('preview fill matches the phone page background (not pure white)', () => {
    expect(PREVIEW_BG).toBe('#f0f0f0')
    expect(PREVIEW_BG_LEVEL).toBe(0xf0)
  })

  it('inkCss / coverageInkByte lighten toward the page background', () => {
    expect(inkCss(0, 1)).toBe('rgb(0,0,0)')
    expect(inkCss(0, 0)).toBe(`rgb(${PREVIEW_BG_LEVEL},${PREVIEW_BG_LEVEL},${PREVIEW_BG_LEVEL})`)
    expect(coverageInkByte(0, 40, 0.55)).toBe(PREVIEW_BG_LEVEL)
    expect(coverageInkByte(1, 40, 0.55)).toBeLessThan(PREVIEW_BG_LEVEL)
  })

  it('lookUp deck uses rounded body frame and Hub pad+border inset', () => {
    const layout = previewLayout(plannedDeckView())
    expect(layout.bodyBorder).toBe(1)
    expect(layout.borderRadius).toBe(PREVIEW_BORDER_RADIUS)
    expect(layout.bodyBand.borderRadius).toBe(PREVIEW_BORDER_RADIUS)
    expect(layout.bodyBand.padding).toBe(4)
    expect(contentInset(layout.bodyBorder, layout.bodyBand.padding)).toBe(5)
    expect(contentWidth(layout.bodyBand.width, layout.bodyBorder, layout.bodyBand.padding)).toBe(566)
  })

  it('drawBandBorder strokes a rounded rect (no sharp-corner fill strips)', () => {
    const calls: string[] = []
    const ctx = {
      strokeStyle: '',
      lineWidth: 0,
      lineJoin: '',
      beginPath() {
        calls.push('beginPath')
      },
      roundRect(x: number, y: number, w: number, h: number, r: number) {
        calls.push(`roundRect:${x},${y},${w},${h},${r}`)
      },
      stroke() {
        calls.push('stroke')
      },
      moveTo() {},
      arcTo() {},
      closePath() {},
    }
    drawBandBorder(
      ctx as unknown as CanvasRenderingContext2D,
      {
        x: 0,
        y: 36,
        width: 576,
        height: 252,
        borderWidth: 1,
        borderRadius: 6,
        padding: 4,
      },
      1,
    )
    expect(calls.some((c) => c.startsWith('roundRect:'))).toBe(true)
    expect(calls).toContain('stroke')
  })
})
