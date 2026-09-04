import {
  GLASSES_H,
  GLASSES_LINE_HEIGHT_PX,
  GLASSES_PADDING_LENGTH,
  GLASSES_W,
  contentInset,
  contentWidth,
  wrapByPixels,
} from './glasses-layout.ts'
import { glassesChrome } from './hub-page.ts'
import type { GlassesView } from './state.ts'

export { GLASSES_H, GLASSES_W, GLASSES_LINE_HEIGHT_PX }

/** Matches hub-page title band height for non-quiet views. */
export const TITLE_BAND_H = 36

/**
 * G2: dual 576×288 monochrome green, 16 greyscale levels
 * (@see https://hub.evenrealities.com/docs/build/display).
 *
 * Phone preview mirrors that as smooth greyscale on the page background —
 * not a binary LED stamp (that made glyphs jagged).
 */
export const RASTER_SCALE = 2
/** Same as phone shell `--bg`. */
export const PREVIEW_BG = '#f0f0f0'
export const PREVIEW_BG_LEVEL = 0xf0
/** Full-ink grey for active chrome (near-black on page bg). */
export const DOT_ACTIVE_LEVEL = 40
/** Dim planned-deck ghost when the live view is blank. */
export const DOT_GHOST_LEVEL = 170
/** Even Hub companion mirror reads ~55% ink; fixed (no slider). */
export const DEFAULT_PREVIEW_INTENSITY = 0.55
/** Hub `borderRadius` 0–10; mild rounding like the official shell. */
export const PREVIEW_BORDER_RADIUS = 6
/** Air around the glasses framebuffer (px); with shell gap 5px → ~30px to cards. */
export const PREVIEW_PAD_PX = 25
/** G2 canvas aspect (576×288 = 2). */
export const PREVIEW_ASPECT = GLASSES_W / GLASSES_H

/**
 * Approximate LVGL evenroster body size. Hub has no font-size control;
 * advance widths cluster around ~14px for Latin capitals (pretext metrics).
 */
export const PREVIEW_FONT_PX = 14

/** Map a 0..255 ink level through preview intensity (1 = full contrast on page bg). */
export function inkCss(level: number, intensity: number): string {
  const i = Math.max(0, Math.min(1, intensity))
  const bg = PREVIEW_BG_LEVEL
  const ink = Math.min(level, bg)
  const v = Math.round(bg - (bg - ink) * i)
  return `rgb(${v},${v},${v})`
}

/** Soft coverage 0..1 → grey byte on page background. */
export function coverageInkByte(
  coverage: number,
  baseLevel: number,
  intensity: number,
): number {
  const c = Math.max(0, Math.min(1, coverage))
  const i = Math.max(0, Math.min(1, intensity)) * c
  const bg = PREVIEW_BG_LEVEL
  const ink = Math.min(baseLevel, bg)
  return Math.round(bg - (bg - ink) * i)
}

export type PreviewBand = {
  x: number
  y: number
  width: number
  height: number
  borderWidth: number
  borderRadius: number
  padding: number
}

export type GlassesPreviewLayout = {
  width: number
  height: number
  quiet: boolean
  titleText: string
  bodyText: string
  titleBorder: number
  bodyBorder: number
  borderRadius: number
  titleBand: PreviewBand
  bodyBand: PreviewBand
}

export function previewLayout(view: GlassesView): GlassesPreviewLayout {
  const chrome = glassesChrome(view)
  const quietBlank = chrome.quiet && view.kind === 'blank'
  const titleH = quietBlank ? 1 : TITLE_BAND_H
  const bodyY = quietBlank ? 1 : TITLE_BAND_H
  const bodyH = quietBlank ? 1 : GLASSES_H - TITLE_BAND_H
  const pad = chrome.quiet ? 0 : GLASSES_PADDING_LENGTH
  const radius = chrome.quiet ? 0 : chrome.borderRadius

  return {
    width: GLASSES_W,
    height: GLASSES_H,
    quiet: chrome.quiet,
    titleText: chrome.title,
    bodyText: chrome.body,
    titleBorder: chrome.titleBorder,
    bodyBorder: chrome.bodyBorder,
    borderRadius: radius,
    titleBand: {
      x: 0,
      y: 0,
      width: GLASSES_W,
      height: titleH,
      borderWidth: chrome.titleBorder,
      borderRadius: chrome.titleBorder > 0 ? radius : 0,
      padding: pad,
    },
    bodyBand: {
      x: 0,
      y: bodyY,
      width: GLASSES_W,
      height: bodyH,
      borderWidth: chrome.bodyBorder,
      borderRadius: chrome.bodyBorder > 0 ? radius : 0,
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

function roundRectPath(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  if (typeof (ctx as CanvasRenderingContext2D).roundRect === 'function') {
    ;(ctx as CanvasRenderingContext2D).roundRect(x, y, w, h, rr)
    return
  }
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** Hub border stroke; supports mild `borderRadius` (official shell is slightly rounded). */
export function drawBandBorder(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  band: PreviewBand,
  scale: number,
) {
  if (band.borderWidth <= 0 || band.height <= 1 || band.width <= 1) return
  const s = scale
  const x0 = band.x * s
  const y0 = band.y * s
  const w = band.width * s
  const h = band.height * s
  const bw = Math.max(1, band.borderWidth * s)
  const r = Math.max(0, band.borderRadius * s)

  ctx.strokeStyle = '#fff'
  ctx.lineWidth = bw
  ctx.lineJoin = 'round'
  roundRectPath(ctx, x0 + bw / 2, y0 + bw / 2, w - bw, h - bw, Math.max(0, r - bw / 2))
  ctx.stroke()
}

function drawBandVector(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  band: PreviewBand,
  content: string,
  scale: number,
) {
  if (band.height <= 1 || band.width <= 1) return
  const s = scale
  drawBandBorder(ctx, band, s)

  const inset = contentInset(band.borderWidth, band.padding)
  const maxW = contentWidth(band.width, band.borderWidth, band.padding)
  if (maxW <= 0) return

  const lines = wrapByPixels(content.replace(/\r/g, ''), maxW)
  const fp = PREVIEW_FONT_PX * s
  ctx.fillStyle = '#fff'
  // Proportional UI font — Hub font is not monospace (design guidelines).
  // Keep default AA so glyphs stay smooth like the official companion mirror.
  ctx.font = `500 ${fp}px "Noto Sans JP", "Hiragino Sans", "Segoe UI", sans-serif`
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ;(ctx as CanvasRenderingContext2D).imageSmoothingEnabled = true

  const x = (band.x + inset) * s
  let y = (band.y + inset) * s
  const lineH = GLASSES_LINE_HEIGHT_PX * s
  const yMax = (band.y + band.height - inset) * s
  for (const line of lines) {
    if (line.length === 0 && lines.length === 1) continue
    if (y + fp > yMax) break
    ctx.fillText(line, x, y)
    y += lineH
  }
}

/**
 * Soft greyscale coverage 0..1 via supersample + average
 * (matches Hub’s 16-level greyscale look; avoids jagged binary LEDs).
 */
export function rasterizeLayoutCoverage(
  layout: GlassesPreviewLayout,
  canvasFactory: () => HTMLCanvasElement | OffscreenCanvas = () =>
    document.createElement('canvas'),
  scale = RASTER_SCALE,
): Float32Array {
  const { width: w, height: h } = layout
  const sw = w * scale
  const sh = h * scale
  const surface = canvasFactory()
  surface.width = sw
  surface.height = sh
  const ctx = (
    'getContext' in surface
      ? surface.getContext('2d', { willReadFrequently: true })
      : null
  ) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  const out = new Float32Array(w * h)
  if (!ctx) return out

  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, sw, sh)
  if (!(layout.quiet && layout.titleBand.height <= 1)) {
    drawBandVector(ctx, layout.titleBand, layout.titleText, scale)
    drawBandVector(ctx, layout.bodyBand, layout.bodyText, scale)
  }

  const img = ctx.getImageData(0, 0, sw, sh)
  const cell = scale * scale
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const p = ((y * scale + dy) * sw + (x * scale + dx)) * 4
          sum += img.data[p]! / 255
        }
      }
      out[y * w + x] = sum / cell
    }
  }
  return out
}

export type PaintPreviewOptions = {
  zoom?: number
  /** 0..1 contrast; defaults to fixed companion intensity. */
  intensity?: number
}

/**
 * Smooth greyscale companion mirror (page bg).
 * Ghost = planned lookUp deck; active = current G2 chrome.
 */
export function paintGlassesPreview(
  canvas: HTMLCanvasElement,
  view: GlassesView,
  opts: PaintPreviewOptions = {},
): GlassesPreviewLayout {
  const layout = previewLayout(view)
  const { width: w, height: h } = layout
  const intensity = opts.intensity ?? DEFAULT_PREVIEW_INTENSITY

  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) return layout

  const ghost = rasterizeLayoutCoverage(previewLayout(plannedDeckView()))
  const active =
    layout.quiet && view.kind === 'blank'
      ? new Float32Array(w * h)
      : rasterizeLayoutCoverage(layout)

  const img = ctx.createImageData(w, h)
  const data = img.data
  const ghostIntensity = Math.min(1, intensity * 0.55)
  for (let i = 0; i < w * h; i++) {
    const a = active[i] ?? 0
    const g = ghost[i] ?? 0
    const activeByte = coverageInkByte(a, DOT_ACTIVE_LEVEL, intensity)
    const ghostByte = coverageInkByte(g, DOT_GHOST_LEVEL, ghostIntensity)
    // Darker wins on the light page background.
    const v = Math.min(activeByte, ghostByte)
    const p = i * 4
    data[p] = v
    data[p + 1] = v
    data[p + 2] = v
    data[p + 3] = 255
  }
  ctx.putImageData(img, 0, 0)

  return layout
}
