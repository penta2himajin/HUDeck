import {
  CreateStartUpPageContainer,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import {
  GLASSES_H,
  GLASSES_LINE_HEIGHT_PX,
  GLASSES_PADDING_LENGTH,
  GLASSES_W,
} from './glasses-layout.ts'
import type { GlassesView } from './state.ts'

export const W = GLASSES_W
export const H = GLASSES_H
export const TITLE_ID = 1
export const BODY_ID = 2
export const TITLE_NAME = 'title'
export const BODY_NAME = 'body'

/** Single-line title band (confirm / recording / chat). */
export const TITLE_BAND_H_SINGLE = 36

/** Mild Hub borderRadius (0–10) for framed decks — matches official shell. */
export const FRAME_BORDER_RADIUS = 6

/** Layout chrome derived from view kind — pure, unit-tested. */
export type GlassesChrome = {
  title: string
  body: string
  titleBorder: number
  bodyBorder: number
  /** Hub `borderRadius` when a frame is drawn. */
  borderRadius: number
  /** Quiet HUD: indicator-only or fully blank (no brand, no deck frame). */
  quiet: boolean
}

/**
 * Title-band pixel height for Hub + preview.
 * Glance deck collapses the title band and packs chrome into the body.
 */
export function titleBandHeight(view: GlassesView, chrome: GlassesChrome = glassesChrome(view)): number {
  if (chrome.quiet && view.kind === 'blank') return 1
  // Deck / settings: header/rule/menu all live in the body stream — no title/body gap.
  if (view.kind === 'deck' || view.kind === 'settings') return 1
  const lines = Math.max(1, chrome.title.split('\n').length)
  if (lines >= 2) {
    return lines * GLASSES_LINE_HEIGHT_PX + 2 * GLASSES_PADDING_LENGTH
  }
  return TITLE_BAND_H_SINGLE
}

/**
 * Brand title "HUDeck" and the deck frame appear only for lookUp deck views
 * (and minimal confirm overlay on an existing deck). Neutral idle is blank.
 */
export function glassesChrome(view: GlassesView): GlassesChrome {
  if (view.kind === 'blank') {
    return {
      title: ' ',
      body: ' ',
      titleBorder: 0,
      bodyBorder: 0,
      borderRadius: 0,
      quiet: true,
    }
  }

  // Neutral recording / chat / settings: indicator only, no brand, no frame.
  if (
    (view.kind === 'recording' || view.kind === 'chat' || view.kind === 'settings') &&
    !view.title &&
    view.indicator
  ) {
    return {
      title: view.indicator,
      body: ' ',
      titleBorder: 0,
      bodyBorder: 0,
      borderRadius: 0,
      quiet: true,
    }
  }

  if (view.kind === 'deck' || view.kind === 'settings') {
    // Pack header + ━ rule + menu into the body so LVGL line slots stay
    // consecutive (no blank between rule and first row). Title band collapses.
    const packed = [view.title, view.body].filter((s) => s && s.trim()).join('\n')
    return {
      title: ' ',
      body: packed || ' ',
      titleBorder: 0,
      bodyBorder: 0,
      borderRadius: 0,
      quiet: false,
    }
  }

  // Expanded recording / chat: content without a Hub body frame.
  if (view.kind === 'recording' || view.kind === 'chat') {
    return {
      title: view.title || view.indicator || ' ',
      body: view.body || (view.indicator && !view.title ? view.indicator : ' '),
      titleBorder: 0,
      bodyBorder: 0,
      borderRadius: 0,
      quiet: false,
    }
  }

  // confirm detail / compact
  return {
    title: view.title || view.indicator || ' ',
    body: view.body || (view.indicator && !view.title ? view.indicator : ' '),
    titleBorder: 0,
    bodyBorder: 1,
    borderRadius: FRAME_BORDER_RADIUS,
    quiet: false,
  }
}

function titleProp(view: GlassesView) {
  const chrome = glassesChrome(view)
  const titleH = titleBandHeight(view, chrome)
  return new TextContainerProperty({
    xPosition: 0,
    yPosition: 0,
    width: W,
    height: titleH,
    borderWidth: chrome.titleBorder,
    borderColor: 5,
    borderRadius: chrome.titleBorder > 0 ? chrome.borderRadius : 0,
    paddingLength: chrome.quiet ? 0 : GLASSES_PADDING_LENGTH,
    containerID: TITLE_ID,
    containerName: TITLE_NAME,
    content: chrome.title,
    // Device default brightness (SDK: omit ≡ level 4). Blank stays quiet.
    ...(chrome.quiet && view.kind === 'blank' ? { textColor: 0 as const } : {}),
    isEventCapture: 0,
  })
}

function bodyProp(view: GlassesView) {
  const chrome = glassesChrome(view)
  const quietBlank = chrome.quiet && view.kind === 'blank'
  const titleH = titleBandHeight(view, chrome)
  return new TextContainerProperty({
    xPosition: 0,
    yPosition: quietBlank ? 1 : titleH,
    width: W,
    height: quietBlank ? 1 : H - titleH,
    borderWidth: chrome.bodyBorder,
    borderColor: 5,
    borderRadius: chrome.bodyBorder > 0 ? chrome.borderRadius : 0,
    paddingLength: chrome.quiet ? 0 : GLASSES_PADDING_LENGTH,
    containerID: BODY_ID,
    containerName: BODY_NAME,
    content: chrome.body,
    ...(quietBlank ? { textColor: 0 as const } : {}),
    isEventCapture: 1,
  })
}

export function buildStartupPage(view: GlassesView) {
  return new CreateStartUpPageContainer({
    containerTotalNum: 2,
    textObject: [titleProp(view), bodyProp(view)],
  })
}

export function buildRebuildPage(view: GlassesView) {
  return new RebuildPageContainer({
    containerTotalNum: 2,
    textObject: [titleProp(view), bodyProp(view)],
  })
}

export function buildTitleUpgrade(view: GlassesView) {
  const chrome = glassesChrome(view)
  return new TextContainerUpgrade({
    containerID: TITLE_ID,
    containerName: TITLE_NAME,
    content: chrome.title,
  })
}

export function buildBodyUpgrade(view: GlassesView) {
  const chrome = glassesChrome(view)
  return new TextContainerUpgrade({
    containerID: BODY_ID,
    containerName: BODY_NAME,
    content: chrome.body,
  })
}
