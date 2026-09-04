import { glassesChrome, H as GLASSES_H, W as GLASSES_W } from './hub-page.ts'
import type { GlassesView } from './state.ts'

export { GLASSES_H, GLASSES_W }

/** Matches hub-page title band height for non-quiet views. */
export const TITLE_BAND_H = 36

/**
 * G2 is dual 576×288 monochrome green micro-LED
 * (@see https://hub.evenrealities.com/docs/reference/glossary#hardware).
 * Even Hub's phone mirror paints that matrix as dark dots on the light
 * companion background — not a solid black panel.
 */
export const DOT_PITCH = 2
export const PREVIEW_BG = '#f0f0f0'
export const DOT_ACTIVE = '#1a1a1a'
export const DOT_GHOST = '#c8c8c8'

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

/** Idle lookUp deck — ghosted when the glasses are blank. */
export function plannedDeckView(): GlassesView {
  return {
    kind: 'deck',
    title: 'HUDeck',
    body: '> Record\n> Chat\nsuggest-armed: off',
    indicator: null,
  }
}

export type DotSample = {
  x: number
  y: number
  kind: 'active' | 'ghost'
}

export function sampleDotsFromCoverage(args: {
  width: number
  height: number
  active: ArrayLike<number>
  ghost: ArrayLike<number>
  pitch: number
  activeThreshold?: number
  ghostThreshold?: number
}): DotSample[] {
  const {
    width,
    height,
    active,
    ghost,
    pitch,
    activeThreshold = 0.35,
    ghostThreshold = 0.18,
  } = args
  const dots: DotSample[] = []
  for (let y = 0; y < height; y += pitch) {
    for (let x = 0; x < width; x += pitch) {
      let aSum = 0
      let gSum = 0
      let n = 0
      for (let dy = 0; dy < pitch && y + dy < height; dy++) {
        for (let dx = 0; dx < pitch && x + dx < width; dx++) {
          const i = (y + dy) * width + (x + dx)
          aSum += active[i] ?? 0
          gSum += ghost[i] ?? 0
          n++
        }
      }
      const a = n ? aSum / n : 0
      const g = n ? gSum / n : 0
      if (a >= activeThreshold) dots.push({ x, y, kind: 'active' })
      else if (g >= ghostThreshold) dots.push({ x, y, kind: 'ghost' })
    }
  }
  return dots
}

function drawBandVector(
  ctx: CanvasRenderingContext2D,
  band: PreviewBand,
  content: string,
  fontPx: number,
) {
  if (band.height <= 1 || band.width <= 1) return
  if (band.borderWidth > 0) {
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = Math.max(1, band.borderWidth)
    ctx.strokeRect(band.x + 0.5, band.y + 0.5, band.width - 1, band.height - 1)
  }
  const lines = content.replace(/\r/g, '').split('\n')
  ctx.fillStyle = '#fff'
  ctx.font = `700 ${fontPx}px ui-monospace, "Cascadia Mono", "SF Mono", monospace`
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

/** Rasterize layout to 0..1 coverage (white ink on black). */
export function rasterizeLayoutCoverage(
  layout: GlassesPreviewLayout,
  canvasFactory: () => HTMLCanvasElement | OffscreenCanvas = () =>
    document.createElement('canvas'),
): Float32Array {
  const { width: w, height: h } = layout
  const surface = canvasFactory()
  surface.width = w
  surface.height = h
  const ctx = (
    'getContext' in surface
      ? surface.getContext('2d', { willReadFrequently: true })
      : null
  ) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  const out = new Float32Array(w * h)
  if (!ctx) return out

  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  if (!(layout.quiet && layout.titleBand.height <= 1)) {
    drawBandVector(ctx as CanvasRenderingContext2D, layout.titleBand, layout.titleText, 18)
    drawBandVector(ctx as CanvasRenderingContext2D, layout.bodyBand, layout.bodyText, 16)
  }

  const img = ctx.getImageData(0, 0, w, h)
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = img.data[p]! / 255
  }
  return out
}

export type PaintPreviewOptions = {
  zoom?: number
}

/**
 * Even Hub–style matrix mirror: light companion bg, ghost (planned) dots,
 * then black active dots for what is actually on the G2.
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

  ctx.fillStyle = PREVIEW_BG
  ctx.fillRect(0, 0, w, h)

  const ghost = rasterizeLayoutCoverage(previewLayout(plannedDeckView()))
  const active =
    layout.quiet && view.kind === 'blank'
      ? new Float32Array(w * h)
      : rasterizeLayoutCoverage(layout)

  const dots = sampleDotsFromCoverage({
    width: w,
    height: h,
    active,
    ghost,
    pitch: DOT_PITCH,
  })

  const r = Math.max(1, DOT_PITCH - 1)
  for (const d of dots) {
    ctx.fillStyle = d.kind === 'active' ? DOT_ACTIVE : DOT_GHOST
    ctx.fillRect(d.x, d.y, r, r)
  }

  return layout
}
