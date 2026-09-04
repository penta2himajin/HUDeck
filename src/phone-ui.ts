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

function button(label: string, onClick: () => void, className = 'btn') {
  const b = el('button', className, label)
  b.type = 'button'
  b.addEventListener('click', onClick)
  return b
}

function group(title: string, ...children: HTMLElement[]) {
  const wrap = el('section', 'control-group')
  wrap.append(el('h2', 'control-group__title', title), ...children)
  return wrap
}

function row(...children: HTMLElement[]) {
  const r = el('div', 'btn-row')
  r.append(...children)
  return r
}

export function createPhoneUi(root: HTMLElement, handlers: PhoneUiHandlers) {
  root.innerHTML = ''
  root.classList.add('phone-shell')

  const header = el('header', 'phone-header')
  header.append(
    el('p', 'phone-eyebrow', 'Even Hub · plugin'),
    el('h1', 'phone-brand', 'HUDeck'),
    el('p', 'phone-sub', 'Ambient deck · look-up glance'),
  )

  const stage = el('section', 'glasses-stage')
  const stageLabel = el('div', 'glasses-stage__label', 'Glasses preview · 576×288')
  const canvas = document.createElement('canvas')
  canvas.className = 'glasses-canvas'
  canvas.width = GLASSES_W
  canvas.height = GLASSES_H
  canvas.setAttribute('aria-label', 'Glasses display preview')
  const stageMeta = el('div', 'glasses-stage__meta', 'view:—')
  stage.append(stageLabel, canvas, stageMeta)

  const debug = el('section', 'debug-panel')
  debug.append(el('h2', 'debug-panel__title', 'Debug'))
  const debugPre = el('pre', 'debug-panel__body')
  debug.append(debugPre)

  const controls = el('section', 'phone-controls')
  controls.append(
    group(
      'Pose',
      row(
        button('Neutral', handlers.onPoseNeutral),
        button('Look up', handlers.onPoseLookUp, 'btn btn--accent'),
      ),
      row(
        button('thr 20°', () => handlers.onThreshold(20), 'btn btn--ghost'),
        button('thr 30°', () => handlers.onThreshold(30), 'btn btn--ghost'),
        button('mock ↑', handlers.onMockLookUp, 'btn btn--ghost'),
        button('mock →', handlers.onMockNeutral, 'btn btn--ghost'),
      ),
    ),
    group(
      'Confirm / capture',
      row(
        button('Detect', handlers.onDetect),
        button('Nod', handlers.onNod, 'btn btn--accent'),
        button('Record', handlers.onRecord),
        button('Stop', handlers.onStop),
      ),
    ),
    group(
      'Chat',
      row(
        button('Open chat', handlers.onOpenChat),
        button('Close chat', handlers.onCloseChat),
      ),
    ),
  )

  const statusChips = el('div', 'status-chips')
  const chipMode = el('span', 'chip', 'mode:—')
  const chipPose = el('span', 'chip', 'pose:—')
  const chipConfirm = el('span', 'chip', 'confirm:—')
  const chipImu = el('span', 'chip', 'imu:—')
  statusChips.append(chipMode, chipPose, chipConfirm, chipImu)

  root.append(header, statusChips, stage, controls, debug)

  return {
    render(state: AppState, view: GlassesView, imu: PhoneImuStatus) {
      paintGlassesPreview(canvas, view, { zoom: 2 })

      const confirm =
        state.confirm.status === 'pending'
          ? state.confirm.tier
          : 'off'
      chipMode.textContent = `mode:${state.mode}`
      chipPose.textContent = `pose:${state.pose}`
      chipConfirm.textContent = `confirm:${confirm}`
      const pitch =
        imu.pitchDeg == null ? '—' : `${imu.pitchDeg.toFixed(1)}°`
      chipImu.textContent = `pitch:${pitch} · thr:${imu.thresholdDeg}° · ${imu.source}`

      stageMeta.textContent = [
        `view:${view.kind}`,
        view.indicator ? `ind:${view.indicator}` : 'ind:—',
        `quiet:${view.kind === 'blank' ? 'yes' : 'no'}`,
      ].join(' · ')

      debugPre.textContent = [
        formatPhoneSummary(state, view),
        `${pitch === '—' ? 'pitch:—' : `pitch:${pitch}`} thr:${imu.thresholdDeg}° src:${imu.source}`,
        `thresholds:${LOOK_UP_THRESHOLDS_DEG.join('/')}`,
        `canvas:${GLASSES_W}×${GLASSES_H} @2×`,
      ].join('\n')
    },
  }
}
