import {
  CreateStartUpPageContainer,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import type { GlassesView } from './state.ts'

export const W = 576
export const H = 288
export const TITLE_ID = 1
export const BODY_ID = 2
export const TITLE_NAME = 'title'
export const BODY_NAME = 'body'

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

  // Neutral recording / chat: indicator only, no brand, no frame.
  if (
    (view.kind === 'recording' || view.kind === 'chat') &&
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

  if (view.kind === 'deck') {
    const title = view.indicator
      ? `${view.title}  ${view.indicator}`
      : view.title || 'HUDeck'
    return {
      title,
      body: view.body || ' ',
      titleBorder: 0,
      bodyBorder: 1,
      borderRadius: FRAME_BORDER_RADIUS,
      quiet: false,
    }
  }

  // confirm detail / compact, or expanded recording / chat
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
  return new TextContainerProperty({
    xPosition: 0,
    yPosition: 0,
    width: W,
    height: chrome.quiet && view.kind === 'blank' ? 1 : 36,
    borderWidth: chrome.titleBorder,
    borderColor: 5,
    borderRadius: chrome.titleBorder > 0 ? chrome.borderRadius : 0,
    paddingLength: chrome.quiet ? 0 : 4,
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
  return new TextContainerProperty({
    xPosition: 0,
    yPosition: quietBlank ? 1 : 36,
    width: W,
    height: quietBlank ? 1 : H - 36,
    borderWidth: chrome.bodyBorder,
    borderColor: 5,
    borderRadius: chrome.bodyBorder > 0 ? chrome.borderRadius : 0,
    paddingLength: chrome.quiet ? 0 : 4,
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
