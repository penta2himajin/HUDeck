import { getTextWidth } from '@evenrealities/pretext'
import {
  GLASSES_PADDING_LENGTH,
  GLASSES_W,
  contentWidth,
} from './glasses-layout.ts'
import { LOOK_UP_THRESHOLDS_DEG, type LookUpThresholdDeg } from './look-up-pose.ts'

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

/** Append spaces until the next space would exceed `maxPx` (pretext metrics). */
export function padEndToWidth(text: string, maxPx: number): string {
  let s = text
  if (getTextWidth(s) > maxPx) return s
  while (getTextWidth(s + ' ') <= maxPx) s += ' '
  return s
}

/** Full-width rule sized to the content box (omochat / pretext).
 * Uses only ━ (U+2501), which exists in evenroster (advW=20).
 * Do not top up with ▬ etc. — those glyphs are missing from firmware fonts
 * (getAdvW=0) so Hub draws a shorter rule than a preview fillRect(maxW).
 */
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
 * The ':' of the clock is anchored to the content-box midline.
 */
export function formatDeckHeader(args: DeckHeaderArgs): string {
  const brand = args.brand ?? 'HUDeck'
  const maxWidth = args.maxWidth ?? deckHeaderContentWidth()
  const mid = `| ${args.timeHm} |`
  const right = args.rightSlot ?? ''
  const midW = getTextWidth(mid)
  const rightW = right ? getTextWidth(right) : 0
  const gapW = getTextWidth(' ')
  const colonW = getTextWidth(':')
  const target = maxWidth / 2

  // Reserve room for an optional right slot; leftover is for brand + clock.
  const rightReserve = right ? rightW + gapW : 0
  const maxLeftPlusMid = maxWidth - rightReserve

  // Thin 4px pad (pretext min advance) to refine after 5px spaces.
  const THIN = '\u2009' // thin space; pretext advance ≈ 4px

  let best = brand + '  ' + mid
  let bestErr = Number.POSITIVE_INFINITY

  for (let spaces = 2; spaces < 80; spaces++) {
    for (let thins = 0; thins < 4; thins++) {
      const pad = ' '.repeat(spaces) + THIN.repeat(thins)
      const candidate = brand + pad + mid
      if (getTextWidth(candidate) > maxLeftPlusMid) {
        if (thins === 0) return finalizeHeader(best, right, maxWidth, rightW)
        break
      }
      const colonAt = candidate.indexOf(':')
      if (colonAt < 0) continue
      const colonCenter = getTextWidth(candidate.slice(0, colonAt)) + colonW / 2
      const err = Math.abs(colonCenter - target)
      if (err < bestErr) {
        bestErr = err
        best = candidate
        if (err === 0) return finalizeHeader(best, right, maxWidth, rightW)
      }
    }
  }
  return finalizeHeader(best, right, maxWidth, rightW)
}

function finalizeHeader(
  line: string,
  right: string,
  maxWidth: number,
  rightW: number,
): string {
  if (!right) return line
  const rightStart = Math.max(getTextWidth(line) + getTextWidth(' '), maxWidth - rightW)
  return padEndToWidth(line, rightStart) + right
}

/** Title band: header + full-width rule on consecutive lines (no blank between). */
export function formatDeckTitle(args: DeckHeaderArgs): string {
  const maxWidth = args.maxWidth ?? deckHeaderContentWidth()
  return `${formatDeckHeader({ ...args, maxWidth })}\n${buildTitleSeparator(maxWidth)}`
}

export type DeckBodyArgs = {
  selectedIndex?: number
  maxWidth?: number
}

/** Menu rows for the idle lookUp deck body. */
export function formatDeckBody(args: DeckBodyArgs = {}): string {
  const selected = args.selectedIndex ?? DECK_MENU_RECORD
  return DECK_MENU_ITEMS.map((label, i) => {
    const bullet = i === selected ? SELECTED_BULLET : IDLE_BULLET
    return `${bullet} ${label}`
  }).join('\n')
}

/** Header + rule + menu as one consecutive block (no blank lines). */
export function formatDeckPacked(
  args: DeckHeaderArgs & DeckBodyArgs,
): string {
  return `${formatDeckTitle(args)}\n${formatDeckBody(args)}`
}

/** Settings title band: label + full-width ━ rule. */
export function formatSettingsTitle(maxWidth = deckHeaderContentWidth()): string {
  return `Settings\n${buildTitleSeparator(maxWidth)}`
}

/** Look-up threshold rows for the settings body. */
export function formatSettingsBody(thresholdDeg: LookUpThresholdDeg): string {
  return [
    'Look-up',
    ...LOOK_UP_THRESHOLDS_DEG.map((deg) => {
      const bullet = deg === thresholdDeg ? SELECTED_BULLET : IDLE_BULLET
      return `${bullet} ${deg}°`
    }),
  ].join('\n')
}
