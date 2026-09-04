import { describe, expect, it } from 'vitest'
import { glassesChrome } from './hub-page.ts'
import { deriveGlassesView, initialState, reduce } from './state.ts'

describe('glassesChrome', () => {
  it('keeps idle neutral blank without HUDeck brand or frame', () => {
    const view = deriveGlassesView(initialState(0), 0)
    expect(view.kind).toBe('blank')
    const chrome = glassesChrome(view)
    expect(chrome.quiet).toBe(true)
    expect(chrome.title.trim()).toBe('')
    expect(chrome.body.trim()).toBe('')
    expect(chrome.bodyBorder).toBe(0)
    expect(chrome.title).not.toContain('HUDeck')
  })

  it('shows HUDeck brand only on lookUp deck', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'pose', pose: 'lookUp' }, 0)
    const view = deriveGlassesView(s, 0)
    expect(view.kind).toBe('deck')
    expect(view.title).toBe('HUDeck')
    const chrome = glassesChrome(view)
    expect(chrome.quiet).toBe(false)
    expect(chrome.title).toContain('HUDeck')
    expect(chrome.bodyBorder).toBe(1)
    expect(chrome.borderRadius).toBe(6)
  })

  it('shows REC indicator without brand frame at recording+neutral', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'startRecordingActive' }, 1000)
    const view = deriveGlassesView(s, 1000)
    const chrome = glassesChrome(view)
    expect(chrome.quiet).toBe(true)
    expect(chrome.title).toBe('REC')
    expect(chrome.bodyBorder).toBe(0)
    expect(chrome.title).not.toContain('HUDeck')
  })
})
