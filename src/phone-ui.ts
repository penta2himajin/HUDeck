import {
  GLASSES_H,
  GLASSES_W,
  paintGlassesPreview,
} from './glasses-preview.ts'
import type { AppState } from './state.ts'
import { formatPhoneSummary, type GlassesView } from './state.ts'
import {
  LOOK_UP_THRESHOLDS_DEG,
  type LookUpThresholdDeg,
} from './look-up-pose.ts'
import { createStoreIconSvg, pixelIcons } from './store-icon.ts'

export type PhoneUiHandlers = {
  onPoseNeutral: () => void
  onPoseLookUp: () => void
  onDetect: () => void
  onNod: () => void
  onRecord: () => void
  onStop: () => void
  onOpenChat: () => void
  onCloseChat: () => void
  onThreshold: (deg: LookUpThresholdDeg) => void
  onMockLookUp: () => void
  onMockNeutral: () => void
}

export type PhoneImuStatus = {
  pitchDeg: number | null
  thresholdDeg: LookUpThresholdDeg
  source: 'imu' | 'manual' | 'none'
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

function tileButton(
  label: string,
  caption: string,
  iconRows: readonly string[],
  onClick: () => void,
  className = 'feature-tile',
) {
  const b = el('button', className)
  b.type = 'button'
  b.append(createStoreIconSvg(iconRows), el('span', 'feature-tile__label', label))
  if (caption) b.append(el('span', 'feature-tile__caption', caption))
  b.addEventListener('click', onClick)
  return b
}

function quickButton(
  label: string,
  iconRows: readonly string[],
  onClick: () => void,
  className = 'quick-btn',
) {
  const b = el('button', className)
  b.type = 'button'
  b.title = label
  b.setAttribute('aria-label', label)
  b.append(createStoreIconSvg(iconRows), el('span', 'quick-btn__label', label))
  b.addEventListener('click', onClick)
  return b
}

export function createPhoneUi(root: HTMLElement, handlers: PhoneUiHandlers) {
  root.innerHTML = ''
  root.classList.add('phone-shell')

  const appBar = el('header', 'app-bar')
  const brandWrap = el('div', 'app-bar__brand')
  brandWrap.append(createStoreIconSvg(pixelIcons.menu), el('span', 'app-bar__title', 'HUDeck'))
  appBar.append(brandWrap)

  const canvas = document.createElement('canvas')
  canvas.className = 'glasses-canvas'
  canvas.width = GLASSES_W
  canvas.height = GLASSES_H
  canvas.setAttribute('aria-label', 'Glasses display preview')

  const quick = el('section', 'quick-row')
  const qThr20 = quickButton('20°', pixelIcons.thr, () => handlers.onThreshold(20))
  const qThr30 = quickButton('30°', pixelIcons.thr, () => handlers.onThreshold(30))
  const qMockUp = quickButton('mock↑', pixelIcons.mockUp, handlers.onMockLookUp)
  const qMockFlat = quickButton('mock→', pixelIcons.mockFlat, handlers.onMockNeutral)
  quick.append(qThr20, qThr30, qMockUp, qMockFlat)

  const grid = el('section', 'feature-grid')
  const btnLookUp = tileButton('見上げ', 'lookUp', pixelIcons.lookUp, handlers.onPoseLookUp)
  const btnNeutral = tileButton('水平', 'neutral', pixelIcons.neutral, handlers.onPoseNeutral)
  const btnDetect = tileButton('検知', 'detect', pixelIcons.detect, handlers.onDetect)
  const btnNod = tileButton('うなずき', 'nod = confirm', pixelIcons.nod, handlers.onNod)
  const btnRecord = tileButton('録音', 'record', pixelIcons.record, handlers.onRecord)
  const btnStop = tileButton('停止', 'stop', pixelIcons.stop, handlers.onStop)
  const btnChat = tileButton('チャット', 'open', pixelIcons.chat, handlers.onOpenChat)
  const btnCloseChat = tileButton('閉じる', 'close chat', pixelIcons.close, handlers.onCloseChat)
  grid.append(
    btnLookUp,
    btnNeutral,
    btnDetect,
    btnNod,
    btnRecord,
    btnStop,
    btnChat,
    btnCloseChat,
  )

  const debug = el('section', 'card card--debug')
  debug.append(el('h2', 'debug-panel__title', 'デバッグ'))
  const debugPre = el('pre', 'debug-panel__body')
  debug.append(debugPre)

  const tabBar = el('nav', 'tab-bar')
  const mkTab = (rows: readonly string[], active = false) => {
    const t = el('button', active ? 'tab-bar__item is-active' : 'tab-bar__item')
    t.type = 'button'
    t.tabIndex = -1
    t.append(createStoreIconSvg(rows))
    return t
  }
  tabBar.append(
    mkTab(pixelIcons.home, true),
    mkTab(pixelIcons.pulse),
    mkTab(pixelIcons.grid),
    mkTab(pixelIcons.gear),
  )

  root.append(appBar, canvas, quick, grid, debug, tabBar)

  const setPressed = (btn: HTMLButtonElement, on: boolean) => {
    btn.classList.toggle('is-pressed', on)
  }

  return {
    render(state: AppState, view: GlassesView, imu: PhoneImuStatus) {
      paintGlassesPreview(canvas, view, { zoom: 2 })

      const pitch =
        imu.pitchDeg == null ? '—' : `${imu.pitchDeg.toFixed(1)}°`

      setPressed(btnLookUp, state.pose === 'lookUp')
      setPressed(btnNeutral, state.pose === 'neutral')
      setPressed(btnRecord, state.mode === 'recording')
      setPressed(btnChat, state.mode === 'chat')
      setPressed(qThr20, imu.thresholdDeg === 20)
      setPressed(qThr30, imu.thresholdDeg === 30)

      debugPre.textContent = [
        formatPhoneSummary(state, view),
        `${pitch === '—' ? 'pitch:—' : `pitch:${pitch}`} thr:${imu.thresholdDeg}° src:${imu.source}`,
        `thresholds:${LOOK_UP_THRESHOLDS_DEG.join('/')}`,
        `canvas:${GLASSES_W}×${GLASSES_H}`,
      ].join('\n')
    },
  }
}
