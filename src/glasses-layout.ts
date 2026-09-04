import { getTextWidth } from '@evenrealities/pretext'

/**
 * Even G2 / Hub text-container geometry.
 * @see https://hub.evenrealities.com/docs/build/display
 * @see @evenrealities/pretext (LVGL line height 27)
 */
export const GLASSES_W = 576
export const GLASSES_H = 288
/** Firmware LVGL line height (pretext / Hub display docs). */
export const GLASSES_LINE_HEIGHT_PX = 27
/** Default TextContainerProperty paddingLength used by hub-page. */
export const GLASSES_PADDING_LENGTH = 4

export function contentInset(borderWidth: number, paddingLength: number): number {
  return borderWidth + paddingLength
}

export function contentWidth(
  containerWidth: number,
  borderWidth: number,
  paddingLength: number,
): number {
  return Math.max(0, containerWidth - 2 * contentInset(borderWidth, paddingLength))
}

function isCjk(cp: number): boolean {
  return (
    (cp >= 0x2e80 && cp <= 0x9fff) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xac00 && cp <= 0xd7af)
  )
}

function isBreakable(cp: number): boolean {
  return cp === 32 || cp === 45 || isCjk(cp)
}

/**
 * Wrap to pixel width with the same break rules as EvenHub / pretext.
 * Returns one string per visual line (no trailing newlines).
 */
export function wrapByPixels(text: string, maxWidth: number): string[] {
  if (!text) return []
  const chars = Array.from(text)
  const cps = chars.map((c) => c.codePointAt(0)!)
  const lines: string[] = []
  let lineStart = 0
  let currentWidth = 0
  let lastBreakIdx = -1
  let i = 0

  while (i < cps.length) {
    const cp = cps[i]!
    if (cp === 10) {
      lines.push(chars.slice(lineStart, i).join(''))
      lineStart = i + 1
      currentWidth = 0
      lastBreakIdx = -1
      i++
      continue
    }
    if (currentWidth === 0 && cp === 32) {
      lineStart = i + 1
      i++
      continue
    }

    const newWidth = getTextWidth(chars.slice(lineStart, i + 1).join(''))

    if (newWidth > maxWidth) {
      if (cp === 32) {
        lines.push(chars.slice(lineStart, i).join(''))
        lineStart = i + 1
        currentWidth = 0
        lastBreakIdx = -1
        i++
      } else if (lastBreakIdx !== -1) {
        const breakCp = cps[lastBreakIdx]!
        if (breakCp === 32) {
          lines.push(chars.slice(lineStart, lastBreakIdx).join(''))
          lineStart = lastBreakIdx + 1
        } else {
          lines.push(chars.slice(lineStart, lastBreakIdx + 1).join(''))
          lineStart = lastBreakIdx + 1
        }
        currentWidth = 0
        lastBreakIdx = -1
        i = lineStart
      } else if (i === lineStart) {
        lines.push(chars[i]!)
        lineStart = i + 1
        currentWidth = 0
        lastBreakIdx = -1
        i++
      } else {
        lines.push(chars.slice(lineStart, i).join(''))
        lineStart = i
        currentWidth = 0
        lastBreakIdx = -1
      }
    } else {
      currentWidth = newWidth
      if (isBreakable(cp)) lastBreakIdx = i
      i++
    }
  }
  lines.push(chars.slice(lineStart).join(''))
  return lines
}
