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

export function createPhoneUi(root: HTMLElement, handlers: PhoneUiHandlers) {
  root.innerHTML = ''
  const status = document.createElement('pre')
  status.className = 'status'
  const controls = document.createElement('div')
  controls.className = 'controls'

  const button = (label: string, onClick: () => void) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = label
    b.addEventListener('click', onClick)
    return b
  }

  controls.append(
    button('pose:neutral', handlers.onPoseNeutral),
    button('pose:lookUp', handlers.onPoseLookUp),
    button('thr:20°', () => handlers.onThreshold(20)),
    button('thr:30°', () => handlers.onThreshold(30)),
    button('mock↑', handlers.onMockLookUp),
    button('mock→', handlers.onMockNeutral),
    button('detect', handlers.onDetect),
    button('nod', handlers.onNod),
    button('record', handlers.onRecord),
    button('stop', handlers.onStop),
    button('chat', handlers.onOpenChat),
    button('close chat', handlers.onCloseChat),
  )

  root.append(status, controls)

  return {
    render(state: AppState, view: GlassesView, imu: PhoneImuStatus) {
      const pitch =
        imu.pitchDeg == null ? 'pitch:—' : `pitch:${imu.pitchDeg.toFixed(1)}°`
      status.textContent = [
        formatPhoneSummary(state, view),
        `${pitch} thr:${imu.thresholdDeg}° src:${imu.source}`,
        `thresholds:${LOOK_UP_THRESHOLDS_DEG.join('/')}`,
      ].join('\n')
    },
  }
}
