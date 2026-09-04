import { describe, expect, it } from 'vitest'
import { getTextWidth } from '@evenrealities/pretext'
import {
  DECK_MENU_CHAT,
  DECK_MENU_ITEMS,
  REC_DOT_LABEL,
  SELECTED_BULLET,
  buildTitleSeparator,
  deckBodyContentWidth,
  deckHeaderContentWidth,
  formatClockHm,
  formatDeckBody,
  formatDeckHeader,
  padEndToWidth,
} from './deck-chrome.ts'

describe('deck chrome', () => {
  it('pads with spaces to a pixel budget without overshooting', () => {
    const s = padEndToWidth('HUDeck', 120)
    expect(getTextWidth(s)).toBeLessThanOrEqual(120)
    expect(getTextWidth(s + ' ')).toBeGreaterThan(120)
  })

  it('builds a single-line full-width title rule', () => {
    const max = deckBodyContentWidth()
    const rule = buildTitleSeparator(max)
    expect(rule.length).toBeGreaterThan(10)
    expect(rule.replaceAll('━', '')).toBe('')
    expect(getTextWidth(rule)).toBeLessThanOrEqual(max)
    expect(getTextWidth(rule + '━')).toBeGreaterThan(max)
  })

  it('formats HH:mm from a Date', () => {
    expect(formatClockHm(new Date(2026, 0, 1, 9, 5))).toBe('09:05')
    expect(formatClockHm(new Date(2026, 0, 1, 15, 37))).toBe('15:37')
  })

  it('centers | hh:mm | between brand and optional REC●', () => {
    const max = deckHeaderContentWidth()
    const line = formatDeckHeader({ timeHm: '15:37', rightSlot: REC_DOT_LABEL, maxWidth: max })
    expect(line.startsWith('HUDeck')).toBe(true)
    expect(line).toContain('| 15:37 |')
    expect(line.endsWith(REC_DOT_LABEL)).toBe(true)
    expect(getTextWidth(line)).toBeLessThanOrEqual(max)

    const mid = '| 15:37 |'
    const midAt = line.indexOf(mid)
    const leftW = getTextWidth(line.slice(0, midAt))
    const rightW = getTextWidth(line.slice(midAt + mid.length))
    // Visually centered: leftover left/right of the mid token are similar.
    expect(Math.abs(leftW - rightW)).toBeLessThan(40)
  })

  it('omits the right slot when not recording', () => {
    const line = formatDeckHeader({ timeHm: '08:00' })
    expect(line).toContain('| 08:00 |')
    expect(line).not.toContain('REC')
  })

  it('formats body as rule + Record/Chat/Settings with ▶ on selection', () => {
    const body = formatDeckBody({ selectedIndex: DECK_MENU_CHAT })
    const lines = body.split('\n')
    expect(lines[0]).toMatch(/^━+$/)
    expect(lines.slice(1)).toEqual([
      `> ${DECK_MENU_ITEMS[0]}`,
      `${SELECTED_BULLET} ${DECK_MENU_ITEMS[1]}`,
      `> ${DECK_MENU_ITEMS[2]}`,
    ])
  })
})
