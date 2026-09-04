import { glassesChrome, H as GLASSES_H, W as GLASSES_W } from './hub-page.ts'
import type { GlassesView } from './state.ts'

export { GLASSES_H, GLASSES_W }

/** Matches hub-page title band height for non-quiet views. */
export const TITLE_BAND_H = 36

/**
 * G2: dual 576×288 monochrome green micro-LED
 * (@see https://hub.evenrealities.com/docs/reference/glossary#hardware).
 * Official simulator screenshots are a 576×288 RGBA framebuffer; `--glow` is
 * phone/simulator post-process only. Even Hub's companion mirror paints that
 * matrix as clean LED dots on the light app background (not a black panel).
 */
export const DOT_PITCH = 3
/** Supersample before max-pool so strokes stay solid (AA text → muddy dots). */
export const RASTER_SCALE = 3
/** Same as phone shell `--bg` so the matrix sits flush on the page. */
export const PREVIEW_BG = '#f0f0f0'
export const PREVIEW_BG_LEVEL = 0xf0
export const DOT_ACTIVE_LEVEL = 28
export const DOT_GHOST_LEVEL = 190
export const DEFAULT_PREVIEW_INTENSITY = 0.85

/** Map a 0..255 ink level through preview intensity (1 = full contrast on page bg). */
export function inkCss(level: number, intensity: number): string {
  const i = Math.max(0, Math.min(1, intensity))
  const bg = PREVIEW_BG_LEVEL
  const ink = Math.min(level, bg)
  const v = Math.round(bg - (bg - ink) * i)
  return `rgb(${v},${v},${v})`
}

export type PreviewBand = {
  x: number
  y: number
  width: number
  height: number
  borderWidth: number
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
    activeThreshold = 0.45,
    ghostThreshold = 0.45,
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
  scale: number,
) {
  if (band.height <= 1 || band.width <= 1) return
  const s = scale
  const x0 = band.x * s
  const y0 = band.y * s
  const w = band.width * s
  const h = band.height * s
  const pad = band.padding * s

  if (band.borderWidth > 0) {
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = Math.max(s, band.borderWidth * s)
    ctx.strokeRect(x0 + s / 2, y0 + s / 2, w - s, h - s)
  }

  const lines = content.replace(/\r/g, '').split('\n')
  const fp = fontPx * s
  ctx.fillStyle = '#fff'
  ctx.font = `800 ${fp}px ui-monospace, "Cascadia Mono", "SF Mono", monospace`
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  const x = x0 + pad + s
  let y = y0 + pad + s
  const lineH = fp + 6 * s
  for (const line of lines) {
    if (line.length === 0 && lines.length === 1) continue
    ctx.fillText(line, x, y)
    y += lineH
    if (y > y0 + h - pad) break
  }
}

/**
 * Rasterize layout to binary-ish 0..1 coverage via supersample + max-pool.
 * Max-pool keeps strokes solid; averaging AA fonts yields muddy LED dots.
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
    drawBandVector(ctx as CanvasRenderingContext2D, layout.titleBand, layout.titleText, 18, scale)
    drawBandVector(ctx as CanvasRenderingContext2D, layout.bodyBand, layout.bodyText, 16, scale)
  }

  const img = ctx.getImageData(0, 0, sw, sh)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let max = 0
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const p = ((y * scale + dy) * sw + (x * scale + dx)) * 4
          const v = img.data[p]! / 255
          if (v > max) max = v
        }
      }
      out[y * w + x] = max >= 0.5 ? 1 : 0
    }
  }
  return out
}

export type PaintPreviewOptions = {
  zoom?: number
  /** 0..1 contrast of lit pixels on white (Even Hub–style mirror). */
  intensity?: number
}

/**
 * Page-background matrix mirror with adjustable ink intensity.
 * Ghost = planned lookUp deck; active = what is currently on the G2.
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

  const activeCss = inkCss(DOT_ACTIVE_LEVEL, intensity)
  const ghostCss = inkCss(DOT_GHOST_LEVEL, Math.min(1, intensity * 0.55))

  // Pixel-perfect LED stamps (no canvas arc AA).
  const r = 1
  for (const d of dots) {
    const cx = d.x + 1
    const cy = d.y + 1
    ctx.fillStyle = d.kind === 'active' ? activeCss : ghostCss
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r + r) {
          ctx.fillRect(cx + dx, cy + dy, 1, 1)
        }
      }
    }
  }

  return layout
}
