import { describe, expect, it } from 'vitest'
import { getTextWidth } from '@evenrealities/pretext'
import {
  DECK_MENU_CHAT,
  DECK_MENU_ITEMS,
  REC_DOT_LABEL,
  SELECTED_BULLET,
  buildTitleSeparator,
  deckHeaderContentWidth,
  formatClockHm,
  formatDeckBody,
  formatDeckHeader,
  formatDeckTitle,
  padEndToWidth,
} from './deck-chrome.ts'

describe('deck chrome', () => {
  it('pads with spaces to a pixel budget without overshooting', () => {
    const s = padEndToWidth('HUDeck', 120)
    expect(getTextWidth(s)).toBeLessThanOrEqual(120)
    expect(getTextWidth(s + ' ')).toBeGreaterThan(120)
  })

  it('builds a single-line full-width title rule', () => {
    const max = deckHeaderContentWidth()
    const rule = buildTitleSeparator(max)
    expect(rule.length).toBeGreaterThan(10)
    // Must reach the content-box right edge (no leftover gap shorter than a ━).
    expect(getTextWidth(rule)).toBe(max)
    expect(rule.startsWith('━')).toBe(true)
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

  it('puts header and rule on consecutive title lines with no blank between', () => {
    const title = formatDeckTitle({ timeHm: '15:37' })
    const lines = title.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('HUDeck')
    expect(lines[0]).toContain('| 15:37 |')
    expect(lines[1]!.startsWith('━')).toBe(true)
    expect(getTextWidth(lines[1]!)).toBe(deckHeaderContentWidth())
  })

  it('formats body as menu only (rule lives in the title band)', () => {
    const body = formatDeckBody({ selectedIndex: DECK_MENU_CHAT })
    expect(body.split('\n')).toEqual([
      `> ${DECK_MENU_ITEMS[0]}`,
      `${SELECTED_BULLET} ${DECK_MENU_ITEMS[1]}`,
      `> ${DECK_MENU_ITEMS[2]}`,
    ])
    expect(body).not.toContain('━')
  })
})
