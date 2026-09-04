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

function svgIcon(paths: string, viewBox = '0 0 24 24'): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', viewBox)
  svg.setAttribute('aria-hidden', 'true')
  svg.classList.add('icon')
  svg.innerHTML = paths
  return svg
}

const icons = {
  menu: '<path d="M4 7h16M4 12h10M4 17h16" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="square"/>',
  lookUp:
    '<path d="M12 19V7M7 12l5-5 5 5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="square" stroke-linejoin="miter"/>',
  neutral:
    '<path d="M5 12h14" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="square"/>',
  detect:
    '<circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="12" cy="12" r="2" fill="currentColor"/>',
  nod: '<path d="M8 10c0-2.2 1.8-4 4-4s4 1.8 4 4c0 3-4 5-4 5s-4-2-4-5z" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M9 19h6" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="square"/>',
  record:
    '<circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/>',
  stop: '<rect x="7" y="7" width="10" height="10" fill="currentColor"/>',
  chat: '<path d="M5 6h14v9H9l-4 3V6z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="miter"/>',
  close:
    '<path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="square"/>',
  thr: '<path d="M6 16l4-8 4 5 4-7" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="square" stroke-linejoin="miter"/>',
  mockUp:
    '<path d="M12 18V6M8 10l4-4 4 4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="square"/>',
  mockFlat:
    '<path d="M5 12h14M16 8l4 4-4 4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="square" stroke-linejoin="miter"/>',
  home: '<path d="M4 11l8-7 8 7v9H4v-9z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="miter"/>',
  grid: '<path d="M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM13 13h6v6h-6z" stroke="currentColor" stroke-width="1.4" fill="none"/>',
  gear: '<path d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM12 3v2.2M12 18.8V21M4.9 6.5l1.6 1.6M17.5 15.9l1.6 1.6M3 12h2.2M18.8 12H21M4.9 17.5l1.6-1.6M17.5 8.1l1.6-1.6" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="square"/>',
  pulse:
    '<path d="M3 12h4l2-5 3 10 2-5h7" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="square" stroke-linejoin="miter"/>',
}

function tileButton(
  label: string,
  caption: string,
  icon: string,
  onClick: () => void,
  className = 'feature-tile',
) {
  const b = el('button', className)
  b.type = 'button'
  b.append(svgIcon(icon), el('span', 'feature-tile__label', label))
  if (caption) b.append(el('span', 'feature-tile__caption', caption))
  b.addEventListener('click', onClick)
  return b
}

function quickButton(
  label: string,
  icon: string,
  onClick: () => void,
  className = 'quick-btn',
) {
  const b = el('button', className)
  b.type = 'button'
  b.title = label
  b.setAttribute('aria-label', label)
  b.append(svgIcon(icon), el('span', 'quick-btn__label', label))
  b.addEventListener('click', onClick)
  return b
}

export function createPhoneUi(root: HTMLElement, handlers: PhoneUiHandlers) {
  root.innerHTML = ''
  root.classList.add('phone-shell')

  const appBar = el('header', 'app-bar')
  const brandWrap = el('div', 'app-bar__brand')
  brandWrap.append(svgIcon(icons.menu), el('span', 'app-bar__title', 'HUDeck'))
  appBar.append(brandWrap, el('span', 'app-bar__meta', 'Even Hub'))

  const hero = el('section', 'hero-row')

  const hudCard = el('article', 'card card--hud')
  const hudTop = el('div', 'hud-card__top')
  const hudDate = el('span', 'hud-card__date', 'preview')
  const hudPills = el('div', 'hud-card__pills')
  const pillView = el('span', 'pill', 'view:—')
  const pillQuiet = el('span', 'pill', 'quiet:—')
  hudPills.append(pillView, pillQuiet)
  hudTop.append(hudDate, hudPills)
  const canvas = document.createElement('canvas')
  canvas.className = 'glasses-canvas'
  canvas.width = GLASSES_W
  canvas.height = GLASSES_H
  canvas.setAttribute('aria-label', 'Glasses display preview')
  const hudFoot = el('div', 'hud-card__foot', '576×288 · TextContainer chrome')
  hudCard.append(hudTop, canvas, hudFoot)

  const statusCard = el('article', 'card card--status')
  statusCard.append(
    el('div', 'status-card__icon-wrap', ''),
  )
  const statusIconHost = statusCard.querySelector('.status-card__icon-wrap')!
  statusIconHost.append(svgIcon(icons.pulse))
  const statusTitle = el('h2', 'status-card__title', '状態')
  const statusBody = el('p', 'status-card__body', 'mode / pose / confirm')
  const statusMeta = el('div', 'status-card__meta')
  const metaMode = el('span', 'meta-line', 'mode:—')
  const metaPose = el('span', 'meta-line', 'pose:—')
  const metaConfirm = el('span', 'meta-line', 'confirm:—')
  const metaImu = el('span', 'meta-line', 'imu:—')
  statusMeta.append(metaMode, metaPose, metaConfirm, metaImu)
  statusCard.append(statusTitle, statusBody, statusMeta)

  hero.append(hudCard, statusCard)

  const quick = el('section', 'quick-row')
  const qThr20 = quickButton('20°', icons.thr, () => handlers.onThreshold(20))
  const qThr30 = quickButton('30°', icons.thr, () => handlers.onThreshold(30))
  const qMockUp = quickButton('mock↑', icons.mockUp, handlers.onMockLookUp)
  const qMockFlat = quickButton('mock→', icons.mockFlat, handlers.onMockNeutral)
  quick.append(qThr20, qThr30, qMockUp, qMockFlat)

  const grid = el('section', 'feature-grid')
  const btnLookUp = tileButton('見上げ', 'lookUp', icons.lookUp, handlers.onPoseLookUp)
  const btnNeutral = tileButton('水平', 'neutral', icons.neutral, handlers.onPoseNeutral)
  const btnDetect = tileButton('検知', 'detect', icons.detect, handlers.onDetect)
  const btnNod = tileButton('うなずき', 'nod = confirm', icons.nod, handlers.onNod)
  const btnRecord = tileButton('録音', 'record', icons.record, handlers.onRecord)
  const btnStop = tileButton('停止', 'stop', icons.stop, handlers.onStop)
  const btnChat = tileButton('チャット', 'open', icons.chat, handlers.onOpenChat)
  const btnCloseChat = tileButton('閉じる', 'close chat', icons.close, handlers.onCloseChat)
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
  const mkTab = (icon: string, active = false) => {
    const t = el('button', active ? 'tab-bar__item is-active' : 'tab-bar__item')
    t.type = 'button'
    t.tabIndex = -1
    t.append(svgIcon(icon))
    return t
  }
  tabBar.append(mkTab(icons.home, true), mkTab(icons.pulse), mkTab(icons.grid), mkTab(icons.gear))

  root.append(appBar, hero, quick, grid, debug, tabBar)

  const setPressed = (btn: HTMLButtonElement, on: boolean) => {
    btn.classList.toggle('is-pressed', on)
  }

  return {
    render(state: AppState, view: GlassesView, imu: PhoneImuStatus) {
      paintGlassesPreview(canvas, view, { zoom: 2 })

      const confirm =
        state.confirm.status === 'pending' ? state.confirm.tier : 'off'
      const pitch =
        imu.pitchDeg == null ? '—' : `${imu.pitchDeg.toFixed(1)}°`

      pillView.textContent = view.kind
      pillQuiet.textContent = view.kind === 'blank' ? 'quiet' : 'active'
      hudFoot.textContent = [
        '576×288',
        view.indicator ? `ind ${view.indicator}` : 'ind —',
        `${imu.thresholdDeg}°`,
      ].join(' · ')

      metaMode.textContent = `mode  ${state.mode}`
      metaPose.textContent = `pose  ${state.pose}`
      metaConfirm.textContent = `confirm  ${confirm}`
      metaImu.textContent = `pitch  ${pitch} · ${imu.source}`
      statusBody.textContent =
        state.pose === 'lookUp'
          ? '見上げデッキを表示中'
          : view.kind === 'blank'
            ? '水平時はグラス非表示'
            : `view: ${view.kind}`

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
