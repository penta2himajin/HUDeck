import { glassesChrome, H as GLASSES_H, W as GLASSES_W } from './hub-page.ts'
import type { GlassesView } from './state.ts'

export { GLASSES_H, GLASSES_W }

/** Matches hub-page title band height for non-quiet views. */
export const TITLE_BAND_H = 36

export type PreviewBand = {
  x: number
  y: number
  width: number
  height: number
  borderWidth: number
  padding: number
}

/**
 * Geometry + copy for the companion glasses preview.
 * Mirrors `hub-page` TextContainer layout so browser dogfood matches device chrome
 * until Glyph owns the framebuffer path.
 */
export type GlassesPreviewLayout = {
  width: number
  height: number
  quiet: boolean
  titleText: string
  bodyText: string
  titleBorder: number
  bodyBorder: number
  titleBand: PreviewBand
  bodyBand: PreviewBand
}

export function previewLayout(view: GlassesView): GlassesPreviewLayout {
  const chrome = glassesChrome(view)
  const quietBlank = chrome.quiet && view.kind === 'blank'
  const titleH = quietBlank ? 1 : TITLE_BAND_H
  const bodyY = quietBlank ? 1 : TITLE_BAND_H
  const bodyH = quietBlank ? 1 : GLASSES_H - TITLE_BAND_H
  const pad = chrome.quiet ? 0 : 4

  return {
    width: GLASSES_W,
    height: GLASSES_H,
    quiet: chrome.quiet,
    titleText: chrome.title,
    bodyText: chrome.body,
    titleBorder: chrome.titleBorder,
    bodyBorder: chrome.bodyBorder,
    titleBand: {
      x: 0,
      y: 0,
      width: GLASSES_W,
      height: titleH,
      borderWidth: chrome.titleBorder,
      padding: pad,
    },
    bodyBand: {
      x: 0,
      y: bodyY,
      width: GLASSES_W,
      height: bodyH,
      borderWidth: chrome.bodyBorder,
      padding: pad,
    },
  }
}

/** Gray levels 0–15 → CSS luminance (device-faithful tone, not phone chrome). */
export function levelToCss(level: number): string {
  const n = Math.max(0, Math.min(15, Math.round(level)))
  const v = Math.round((n / 15) * 255)
  return `rgb(${v},${v},${v})`
}

export type PaintPreviewOptions = {
  /** Logical zoom for nearest-neighbour scale (1–3). */
  zoom?: number
}

/**
 * Paint the current glasses chrome into a canvas at 1:1 logical pixels.
 * Display scale is CSS-only (nearest-neighbour via image-rendering).
 */
export function paintGlassesPreview(
  canvas: HTMLCanvasElement,
  view: GlassesView,
  _opts: PaintPreviewOptions = {},
): GlassesPreviewLayout {
  const layout = previewLayout(view)
  const { width: w, height: h } = layout

  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) return layout

  ctx.fillStyle = levelToCss(0)
  ctx.fillRect(0, 0, w, h)

  if (layout.quiet && view.kind === 'blank') {
    return layout
  }

  const stroke = levelToCss(6)
  const text = levelToCss(15)

  const drawBand = (
    band: PreviewBand,
    content: string,
    fontPx: number,
  ) => {
    if (band.borderWidth > 0) {
      ctx.strokeStyle = stroke
      ctx.lineWidth = Math.max(1, band.borderWidth)
      ctx.strokeRect(
        band.x + 0.5,
        band.y + 0.5,
        band.width - 1,
        band.height - 1,
      )
    }
    const lines = content.replace(/\r/g, '').split('\n')
    ctx.fillStyle = text
    ctx.font = `600 ${fontPx}px ui-monospace, "Cascadia Mono", "SF Mono", monospace`
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    const x = band.x + band.padding + 2
    let y = band.y + band.padding + 2
    const lineH = fontPx + 6
    for (const line of lines) {
      if (line.length === 0 && lines.length === 1) continue
      ctx.fillText(line, x, y)
      y += lineH
      if (y > band.y + band.height - band.padding) break
    }
  }

  drawBand(layout.titleBand, layout.titleText, 18)
  if (!(layout.quiet && view.kind === 'blank')) {
    drawBand(layout.bodyBand, layout.bodyText, 16)
  }

  return layout
}
