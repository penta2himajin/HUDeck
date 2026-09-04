import { getTextWidth } from '@evenrealities/pretext'
import {
  GLASSES_PADDING_LENGTH,
  GLASSES_W,
  contentWidth,
} from './glasses-layout.ts'

/** Default selected row on the idle lookUp deck (Record). */
export const DECK_MENU_RECORD = 0
export const DECK_MENU_CHAT = 1
export const DECK_MENU_SETTINGS = 2

export const DECK_MENU_ITEMS = ['Record', 'Chat', 'Settings'] as const

export const REC_DOT_LABEL = 'REC●'
export const SELECTED_BULLET = '▶'
export const IDLE_BULLET = '>'

/** Title-band content width (border 0, pad 4) — matches hub-page titleProp. */
export function deckHeaderContentWidth(
  canvasWidth = GLASSES_W,
  padding = GLASSES_PADDING_LENGTH,
): number {
  return contentWidth(canvasWidth, 0, padding)
}

/** Body content width (border 0, pad 4) — matches frameless hub-page deck body. */
export function deckBodyContentWidth(
  canvasWidth = GLASSES_W,
  padding = GLASSES_PADDING_LENGTH,
  border = 0,
): number {
  return contentWidth(canvasWidth, border, padding)
}

/** Append spaces until the next space would exceed `maxPx` (pretext metrics). */
export function padEndToWidth(text: string, maxPx: number): string {
  let s = text
  if (getTextWidth(s) > maxPx) return s
  while (getTextWidth(s + ' ') <= maxPx) s += ' '
  return s
}

/** Full-width rule sized to the content box (omochat / pretext). */
export function buildTitleSeparator(maxWidth: number): string {
  let s = ''
  while (getTextWidth(s + '━') <= maxWidth) s += '━'
  return s
}

export function formatClockHm(date: Date): string {
  const hh = date.getHours().toString().padStart(2, '0')
  const mm = date.getMinutes().toString().padStart(2, '0')
  return `${hh}:${mm}`
}

export type DeckHeaderArgs = {
  timeHm: string
  /** Right-slot label: `REC●` while recording, `REC?` on minimal confirm, else empty. */
  rightSlot?: string
  brand?: string
  maxWidth?: number
}

/**
 * Glance-deck title row:
 * `HUDeck        | 15:37 |        REC●`
 * Time stays visually centered; right slot is right-aligned when present.
 */
export function formatDeckHeader(args: DeckHeaderArgs): string {
  const brand = args.brand ?? 'HUDeck'
  const maxWidth = args.maxWidth ?? deckHeaderContentWidth()
  const mid = `| ${args.timeHm} |`
  const right = args.rightSlot ?? ''
  const brandW = getTextWidth(brand)
  const midW = getTextWidth(mid)
  const rightW = right ? getTextWidth(right) : 0

  let midStart = Math.max(0, Math.floor((maxWidth - midW) / 2))
  if (midStart < brandW + getTextWidth('  ')) {
    midStart = brandW + getTextWidth('  ')
  }
  const rightStart = right ? Math.max(midStart + midW + getTextWidth(' '), maxWidth - rightW) : maxWidth

  let line = padEndToWidth(brand, midStart) + mid
  if (right) {
    line = padEndToWidth(line, rightStart) + right
  }
  // Do not force-pad to maxWidth — trailing spaces are invisible and waste Hub UTF-8 budget.
  return line
}

export type DeckBodyArgs = {
  selectedIndex?: number
  maxWidth?: number
}

/** Separator + menu rows for the idle lookUp deck body. */
export function formatDeckBody(args: DeckBodyArgs = {}): string {
  const maxWidth = args.maxWidth ?? deckBodyContentWidth()
  const selected = args.selectedIndex ?? DECK_MENU_RECORD
  const rule = buildTitleSeparator(maxWidth)
  const menu = DECK_MENU_ITEMS.map((label, i) => {
    const bullet = i === selected ? SELECTED_BULLET : IDLE_BULLET
    return `${bullet} ${label}`
  })
  return [rule, ...menu].join('\n')
}
