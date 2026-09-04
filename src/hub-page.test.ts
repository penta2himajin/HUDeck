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
    expect(view.title).toContain('HUDeck')
    expect(view.title).toMatch(/\|\s*\d{2}:\d{2}\s*\|/)
    const chrome = glassesChrome(view)
    expect(chrome.quiet).toBe(false)
    expect(chrome.title).toContain('HUDeck')
    expect(chrome.title.split('\n')[1]?.startsWith('━')).toBe(true)
    expect(chrome.body).toContain('▶ Record')
    // Glance deck is text-only (━ rule), no Hub container frame.
    expect(chrome.bodyBorder).toBe(0)
    expect(chrome.borderRadius).toBe(0)
  })

  it('shows REC● indicator without brand frame at recording+neutral', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'startRecordingActive' }, 1000)
    const view = deriveGlassesView(s, 1000)
    const chrome = glassesChrome(view)
    expect(chrome.quiet).toBe(true)
    expect(chrome.title).toBe('REC●')
    expect(chrome.bodyBorder).toBe(0)
    expect(chrome.title).not.toContain('HUDeck')
  })

  it('keeps recording lookUp frameless (no Hub body border)', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'startRecordingActive' }, 1000)
    s = reduce(s, { type: 'pose', pose: 'lookUp' }, 1000)
    const view = deriveGlassesView(s, 5000)
    expect(view.kind).toBe('recording')
    expect(view.title).toContain('REC●')
    const chrome = glassesChrome(view)
    expect(chrome.bodyBorder).toBe(0)
    expect(chrome.borderRadius).toBe(0)
    expect(chrome.quiet).toBe(false)
  })
})
