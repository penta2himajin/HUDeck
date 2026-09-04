import {
  DEFAULT_PREVIEW_INTENSITY,
  GLASSES_H,
  GLASSES_W,
  paintGlassesPreview,
} from './glasses-preview.ts'
import type { ControlId } from './head-tilt.ts'
import { FIXED_CONTROL_TO_GESTURE } from './head-tilt.ts'
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
  onControl: (control: ControlId) => void
  onRecord: () => void
  onStop: () => void
  onOpenChat: () => void
  onCloseChat: () => void
  onOpenSettings: () => void
  onCloseSettings: () => void
  onThreshold: (deg: LookUpThresholdDeg) => void
  onMockLookUp: () => void
  onMockNeutral: () => void
}

export type PhoneImuStatus = {
  pitchDeg: number | null
  /** Roll deg: + = tilt-R, − = tilt-L (null until first sample). */
  rollDeg: number | null
  thresholdDeg: LookUpThresholdDeg
  source: 'imu' | 'manual' | 'none'
  /** lookUp-baseline tilt session armed. */
  tiltArmed: boolean
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
  const previewWrap = el('div', 'glasses-preview')
  previewWrap.append(canvas)

  const quick = el('section', 'quick-row')
  const qThr20 = quickButton('20°', pixelIcons.thr, () => handlers.onThreshold(20))
  const qThr30 = quickButton('30°', pixelIcons.thr, () => handlers.onThreshold(30))
  const qMockUp = quickButton('mock↑', pixelIcons.mockUp, handlers.onMockLookUp)
  const qMockFlat = quickButton('mock→', pixelIcons.mockFlat, handlers.onMockNeutral)
  const qTap = quickButton('tap', pixelIcons.nod, () => handlers.onControl('tap'))
  const qDbl = quickButton('dbl', pixelIcons.close, () => handlers.onControl('dbl'))
  const qSwipeUp = quickButton('↑L', pixelIcons.lookUp, () => handlers.onControl('swipe-up'))
  const qSwipeDown = quickButton('↓R', pixelIcons.neutral, () =>
    handlers.onControl('swipe-down'),
  )
  quick.append(qThr20, qThr30, qMockUp, qMockFlat, qTap, qDbl, qSwipeUp, qSwipeDown)

  const grid = el('section', 'feature-grid')
  const btnLookUp = tileButton('見上げ', 'lookUp', pixelIcons.lookUp, handlers.onPoseLookUp)
  const btnNeutral = tileButton('水平', 'neutral', pixelIcons.neutral, handlers.onPoseNeutral)
  const btnDetect = tileButton('検知', 'detect', pixelIcons.detect, handlers.onDetect)
  const btnNod = tileButton('うなずき', 'tap / confirm', pixelIcons.nod, handlers.onNod)
  const btnRecord = tileButton('録音', 'record', pixelIcons.record, handlers.onRecord)
  const btnStop = tileButton('停止', 'stop', pixelIcons.stop, handlers.onStop)
  const btnChat = tileButton('チャット', 'open', pixelIcons.chat, handlers.onOpenChat)
  const btnSettings = tileButton(
    '設定',
    'look-up',
    pixelIcons.gear,
    handlers.onOpenSettings,
  )
  const btnClose = tileButton(
    '閉じる',
    'chat / settings',
    pixelIcons.close,
    () => {
      handlers.onCloseChat()
      handlers.onCloseSettings()
    },
  )
  grid.append(
    btnLookUp,
    btnNeutral,
    btnDetect,
    btnNod,
    btnRecord,
    btnStop,
    btnChat,
    btnSettings,
    btnClose,
  )

  const debug = el('section', 'card card--debug')
  debug.append(el('h2', 'debug-panel__title', 'デバッグ'))
  const debugPre = el('pre', 'debug-panel__body')
  debug.append(debugPre)

  root.append(appBar, previewWrap, quick, grid, debug)

  const setPressed = (btn: HTMLButtonElement, on: boolean) => {
    btn.classList.toggle('is-pressed', on)
  }

  return {
    render(state: AppState, view: GlassesView, imu: PhoneImuStatus) {
      paintGlassesPreview(canvas, view, { intensity: DEFAULT_PREVIEW_INTENSITY })

      const pitch =
        imu.pitchDeg == null ? '—' : `${imu.pitchDeg.toFixed(1)}°`
      const roll =
        imu.rollDeg == null ? '—' : `${imu.rollDeg.toFixed(1)}°`

      setPressed(btnLookUp, state.pose === 'lookUp')
      setPressed(btnNeutral, state.pose === 'neutral')
      setPressed(btnRecord, state.mode === 'recording')
      setPressed(btnChat, state.mode === 'chat')
      setPressed(btnSettings, state.mode === 'settings')
      setPressed(qThr20, imu.thresholdDeg === 20)
      setPressed(qThr30, imu.thresholdDeg === 30)

      debugPre.textContent = [
        formatPhoneSummary(state, view),
        `pitch:${pitch} roll:${roll} thr:${imu.thresholdDeg}° src:${imu.source}`,
        `tiltArmed:${imu.tiltArmed ? 'on' : 'off'} map:tap=${FIXED_CONTROL_TO_GESTURE.tap} dbl=${FIXED_CONTROL_TO_GESTURE.dbl} ↑=${FIXED_CONTROL_TO_GESTURE['swipe-up']} ↓=${FIXED_CONTROL_TO_GESTURE['swipe-down']}`,
        `thresholds:${LOOK_UP_THRESHOLDS_DEG.join('/')}`,
        `canvas:${GLASSES_W}×${GLASSES_H}`,
        `ink:${Math.round(DEFAULT_PREVIEW_INTENSITY * 100)}%`,
      ].join('\n')
    },
  }
}
