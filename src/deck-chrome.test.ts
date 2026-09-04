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
  formatDeckPacked,
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

  it('centers the clock so the colon sits at the content midline', () => {
    const max = deckHeaderContentWidth()
    for (const timeHm of ['15:37', '09:05', '00:00', '22:58', '12:00']) {
      const line = formatDeckHeader({ timeHm, maxWidth: max })
      const colonAt = line.indexOf(':')
      expect(colonAt).toBeGreaterThan(0)
      const colonCenter =
        getTextWidth(line.slice(0, colonAt)) + getTextWidth(':') / 2
      expect(Math.abs(colonCenter - max / 2)).toBeLessThan(1)
    }
  })

  it('keeps colon-centered clock with a right slot', () => {
    const max = deckHeaderContentWidth()
    const line = formatDeckHeader({
      timeHm: '15:37',
      rightSlot: REC_DOT_LABEL,
      maxWidth: max,
    })
    expect(line.startsWith('HUDeck')).toBe(true)
    expect(line.endsWith(REC_DOT_LABEL)).toBe(true)
    const colonAt = line.indexOf(':')
    const colonCenter =
      getTextWidth(line.slice(0, colonAt)) + getTextWidth(':') / 2
    expect(Math.abs(colonCenter - max / 2)).toBeLessThan(1)
  })

  it('omits the right slot when not recording', () => {
    const line = formatDeckHeader({ timeHm: '08:00' })
    expect(line).toContain('| 08:00 |')
    expect(line).not.toContain('REC')
  })

  it('packs header, rule, and menu as consecutive lines with no blanks', () => {
    const packed = formatDeckPacked({ timeHm: '15:37' })
    const lines = packed.split('\n')
    expect(lines[0]).toContain('HUDeck')
    expect(lines[0]).toContain('| 15:37 |')
    expect(lines[1]!.startsWith('━')).toBe(true)
    expect(getTextWidth(lines[1]!)).toBe(deckHeaderContentWidth())
    expect(lines.slice(2)).toEqual([
      `${SELECTED_BULLET} ${DECK_MENU_ITEMS[0]}`,
      `> ${DECK_MENU_ITEMS[1]}`,
      `> ${DECK_MENU_ITEMS[2]}`,
    ])
    expect(lines.every((l) => l.length > 0)).toBe(true)
  })

  it('formats body as menu only', () => {
    const body = formatDeckBody({ selectedIndex: DECK_MENU_CHAT })
    expect(body.split('\n')).toEqual([
      `> ${DECK_MENU_ITEMS[0]}`,
      `${SELECTED_BULLET} ${DECK_MENU_ITEMS[1]}`,
      `> ${DECK_MENU_ITEMS[2]}`,
    ])
    expect(body).not.toContain('━')
  })
})
