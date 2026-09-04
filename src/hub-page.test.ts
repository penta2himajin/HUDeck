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
    // Entire deck chrome is one body stream (header / rule / menu) — no blank slots.
    const lines = chrome.body.split('\n')
    expect(lines[0]).toContain('HUDeck')
    expect(lines[1]?.startsWith('━')).toBe(true)
    expect(lines[2]).toBe('▶ Record')
    expect(chrome.title.trim()).toBe('')
    expect(chrome.bodyBorder).toBe(0)
    expect(chrome.borderRadius).toBe(0)
  })

  it('collapses the title band so rule sits directly above Record', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'pose', pose: 'lookUp' }, 0)
    const view = deriveGlassesView(s, 0)
    const chrome = glassesChrome(view)
    // Title container is collapsed; all lines live in body with no blank between rule and menu.
    expect(chrome.title.trim()).toBe('')
    const lines = chrome.body.split('\n')
    const ruleIdx = lines.findIndex((l) => l.startsWith('━'))
    expect(ruleIdx).toBeGreaterThanOrEqual(0)
    expect(lines[ruleIdx + 1]).toBe('▶ Record')
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
