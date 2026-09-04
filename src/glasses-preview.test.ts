import { describe, expect, it } from 'vitest'
import {
  GLASSES_H,
  GLASSES_W,
  TITLE_BAND_H,
  previewLayout,
} from './glasses-preview.ts'
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
    expect(layout.titleBand.height).toBe(TITLE_BAND_H)
    expect(layout.bodyBand.y).toBe(TITLE_BAND_H)
    expect(layout.bodyBand.height).toBe(GLASSES_H - TITLE_BAND_H)
    expect(layout.titleText).toBe(chrome.title)
    expect(layout.bodyText).toBe(chrome.body)
    expect(layout.bodyBorder).toBe(1)
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
