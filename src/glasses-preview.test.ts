import { describe, expect, it } from 'vitest'
import { getTextWidth } from '@evenrealities/pretext'
import {
  GLASSES_H,
  GLASSES_W,
  drawBandVector,
  isDeckRuleLine,
  plannedDeckView,
  previewLayout,
  shouldShowPlannedDeckGhost,
} from './glasses-preview.ts'
import { buildTitleSeparator, deckHeaderContentWidth } from './deck-chrome.ts'
import { glassesChrome } from './hub-page.ts'
import { deriveGlassesView, initialState, reduce } from './state.ts'

describe('previewLayout', () => {
  it('matches hub chrome geometry for lookUp deck', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'pose', pose: 'lookUp' }, 0)
    const view = deriveGlassesView(s, 0)
    const chrome = glassesChrome(view)
    const layout = previewLayout(view)

    expect(layout.width).toBe(GLASSES_W)
    expect(layout.height).toBe(GLASSES_H)
    // Deck packs into the body band; title container is collapsed.
    expect(layout.titleBand.height).toBe(1)
    expect(layout.bodyBand.y).toBe(1)
    expect(layout.bodyBand.height).toBe(GLASSES_H - 1)
    expect(layout.titleText.trim()).toBe('')
    expect(layout.bodyText).toBe(chrome.body)
    expect(layout.bodyBorder).toBe(0)
    expect(layout.quiet).toBe(false)
  })

  it('collapses to quiet blank geometry for idle neutral', () => {
    const view = deriveGlassesView(initialState(0), 0)
    const layout = previewLayout(view)
    expect(layout.quiet).toBe(true)
    expect(layout.titleBand.height).toBe(1)
    expect(layout.bodyBand.y).toBe(1)
    expect(layout.bodyBand.height).toBe(1)
    expect(layout.titleText.trim()).toBe('')
    expect(layout.bodyText.trim()).toBe('')
  })
})

describe('preview rule + ghost', () => {
  it('detects deck rule lines for full-bleed canvas bars', () => {
    const rule = buildTitleSeparator(deckHeaderContentWidth())
    expect(isDeckRuleLine(rule)).toBe(true)
    expect(getTextWidth(rule)).toBe(deckHeaderContentWidth())
    expect(isDeckRuleLine('▶ Record')).toBe(false)
    expect(isDeckRuleLine('HUDeck | 12:00 |')).toBe(false)
  })

  it('shows planned-deck ghost only on blank idle', () => {
    expect(shouldShowPlannedDeckGhost(deriveGlassesView(initialState(0), 0))).toBe(true)
    let s = initialState(0)
    s = reduce(s, { type: 'pose', pose: 'lookUp' }, 0)
    expect(shouldShowPlannedDeckGhost(deriveGlassesView(s, 0))).toBe(false)
    s = reduce(s, { type: 'startRecordingActive' }, 1)
    expect(shouldShowPlannedDeckGhost(deriveGlassesView(s, 1))).toBe(false)
  })

  it('draws rule lines as a full content-width fillRect (not short ━ glyphs)', () => {
    const calls: string[] = []
    const ctx = {
      fillStyle: '',
      font: '',
      textBaseline: '',
      textAlign: '',
      imageSmoothingEnabled: true,
      beginPath() {},
      stroke() {},
      roundRect() {},
      fillText(text: string) {
        calls.push(`fillText:${text.slice(0, 8)}`)
      },
      fillRect(x: number, y: number, w: number, h: number) {
        calls.push(`fillRect:${x},${w}`)
      },
    }
    const view = plannedDeckView()
    const layout = previewLayout(view)
    drawBandVector(
      ctx as unknown as CanvasRenderingContext2D,
      layout.bodyBand,
      layout.bodyText,
      1,
    )
    const bar = calls.find((c) => c.startsWith('fillRect:'))
    expect(bar).toBeTruthy()
    // Content width 568 at scale 1, x starts at padding 4.
    expect(bar).toBe('fillRect:4,568')
    expect(calls.some((c) => c.startsWith('fillText:━'))).toBe(false)
  })
})
