import './style.css'
import {
  ImuReportPace,
  OsEventTypeList,
  waitForEvenAppBridge,
  type EvenAppBridge,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk'
import {
  buildBodyUpgrade,
  buildRebuildPage,
  buildStartupPage,
  buildTitleUpgrade,
} from './hub-page.ts'
import { parseAccelSample } from './imu-parse.ts'
import {
  DEFAULT_LOOK_UP_THRESHOLD_DEG,
  isLookUpThresholdDeg,
  pitchDegreesFromGravity,
  resolveLookUpPose,
  shouldIgnoreTemplePoseToggle,
  type LookUpThresholdDeg,
} from './look-up-pose.ts'
import { gravityAtPitchDeg, mockImuEnabled, startMockImu } from './mock-imu.ts'
import { createPhoneUi, type PhoneImuStatus } from './phone-ui.ts'
import {
  READY_MARKER,
  deriveGlassesView,
  initialState,
  reduce,
  type AppEvent,
  type AppState,
} from './state.ts'

const THRESHOLD_STORAGE_KEY = 'hudeck-look-up-threshold-v1'

function evenHubHostPresent(): boolean {
  const w = window as unknown as { flutter_inappwebview?: { callHandler?: unknown } }
  return typeof w.flutter_inappwebview?.callHandler === 'function'
}

async function waitForHost(timeoutMs = 300): Promise<boolean> {
  if (evenHubHostPresent()) return true
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50))
    if (evenHubHostPresent()) return true
  }
  return evenHubHostPresent()
}

function pickEvent(event: EvenHubEvent) {
  return event.textEvent ?? event.listEvent ?? event.sysEvent
}

function loadThreshold(): LookUpThresholdDeg {
  try {
    const raw = localStorage.getItem(THRESHOLD_STORAGE_KEY)
    const n = raw == null ? NaN : Number(raw)
    if (isLookUpThresholdDeg(n)) return n
  } catch {
    /* ignore */
  }
  return DEFAULT_LOOK_UP_THRESHOLD_DEG
}

function saveThreshold(deg: LookUpThresholdDeg): void {
  try {
    localStorage.setItem(THRESHOLD_STORAGE_KEY, String(deg))
  } catch {
    /* ignore */
  }
}

async function main() {
  const root = document.querySelector('#app')
  if (!(root instanceof HTMLElement)) throw new Error('#app missing')
  let state: AppState = initialState(Date.now())
  let lastViewKey = ''
  let thresholdDeg: LookUpThresholdDeg = loadThreshold()
  let pitchDeg: number | null = null
  let poseSource: PhoneImuStatus['source'] = 'none'
  let imuSampleSeen = false
  let imuOpen = false
  let hub: EvenAppBridge | null = null

  const imuStatus = (): PhoneImuStatus => ({
    pitchDeg,
    thresholdDeg,
    source: poseSource,
  })

  const paint = async (rebuild = false) => {
    const now = Date.now()
    const view = deriveGlassesView(state, now)
    phone.render(state, view, imuStatus())
    const key = `${view.kind}|${view.title}|${view.body}|${view.indicator}`
    if (!hub) {
      lastViewKey = key
      return
    }
    const prevKind = lastViewKey.split('|')[0]
    const needsRebuild =
      rebuild ||
      lastViewKey === '' ||
      prevKind !== view.kind ||
      (prevKind === 'blank') !== (view.kind === 'blank')
    if (needsRebuild) {
      await hub.rebuildPageContainer(buildRebuildPage(view))
    } else if (key !== lastViewKey) {
      await hub.textContainerUpgrade(buildTitleUpgrade(view))
      await hub.textContainerUpgrade(buildBodyUpgrade(view))
    }
    lastViewKey = key
  }

  function dispatch(event: AppEvent) {
    const beforeMode = state.mode
    const beforeConfirm = state.confirm.status
    const beforePose = state.pose
    state = reduce(state, event, Date.now())
    const structural =
      beforeMode !== state.mode ||
      beforeConfirm !== state.confirm.status ||
      beforePose !== state.pose ||
      (state.confirm.status === 'pending' && event.type === 'pose')
    void paint(structural)
  }

  function applyImuPitch(nextPitch: number, opts: { force?: boolean } = {}) {
    imuSampleSeen = true
    pitchDeg = nextPitch
    // Manual pose buttons win over mock rest ticks until mock↑/mock→ (force) or real intent.
    if (poseSource === 'manual' && !opts.force) {
      void paint(false)
      return
    }
    poseSource = 'imu'
    const nextPose = resolveLookUpPose({
      pitchDeg: nextPitch,
      thresholdDeg,
      previous: state.pose,
    })
    if (nextPose !== state.pose) {
      dispatch({ type: 'pose', pose: nextPose })
    } else {
      void paint(false)
    }
  }

  const phone = createPhoneUi(root, {
    onPoseNeutral: () => {
      // Align mock gravity so the rest stream does not snap pose back.
      const g = gravityAtPitchDeg(0)
      window.__hudeckInjectImu?.(g.x, g.y, g.z)
      poseSource = 'manual'
      pitchDeg = 0
      dispatch({ type: 'pose', pose: 'neutral' })
    },
    onPoseLookUp: () => {
      const g = gravityAtPitchDeg(thresholdDeg + 5)
      window.__hudeckInjectImu?.(g.x, g.y, g.z)
      poseSource = 'manual'
      pitchDeg = pitchDegreesFromGravity(g)
      dispatch({ type: 'pose', pose: 'lookUp' })
    },
    onDetect: () => dispatch({ type: 'conversationDetected' }),
    onNod: () => dispatch({ type: 'nod' }),
    onRecord: () => dispatch({ type: 'startRecordingActive' }),
    onStop: () => dispatch({ type: 'stopRecording' }),
    onOpenChat: () => dispatch({ type: 'openChat' }),
    onCloseChat: () => dispatch({ type: 'closeChat' }),
    onThreshold: (deg) => {
      thresholdDeg = deg
      saveThreshold(deg)
      if (pitchDeg != null) applyImuPitch(pitchDeg)
      else void paint(false)
    },
    onMockLookUp: () => {
      const g = gravityAtPitchDeg(thresholdDeg + 5)
      window.__hudeckInjectImu?.(g.x, g.y, g.z)
      applyImuPitch(pitchDegreesFromGravity(g), { force: true })
    },
    onMockNeutral: () => {
      const g = gravityAtPitchDeg(0)
      window.__hudeckInjectImu?.(g.x, g.y, g.z)
      applyImuPitch(pitchDegreesFromGravity(g), { force: true })
    },
  })

  // Preview + controls work immediately in plain browser; Hub attaches if present.
  await paint(true)

  const hasHost = await waitForHost()
  if (hasHost) {
    hub = await waitForEvenAppBridge()
  }

  const ensureImu = async (bridge: EvenAppBridge) => {
    await bridge.imuControl(true, ImuReportPace.P100)
    imuOpen = true
  }

  const stopImu = async (bridge: EvenAppBridge) => {
    if (!imuOpen) return
    await bridge.imuControl(false)
    imuOpen = false
  }

  if (hub) {
    const bootView = deriveGlassesView(state, Date.now())
    await hub.createStartUpPageContainer(buildStartupPage(bootView))
    lastViewKey = `${bootView.kind}|${bootView.title}|${bootView.body}|${bootView.indicator}`
    phone.render(state, bootView, imuStatus())

    console.info(READY_MARKER)

    hub.onEvenHubEvent((event) => {
      const sysType = event.sysEvent?.eventType
      if (sysType === OsEventTypeList.IMU_DATA_REPORT && event.sysEvent?.imuData) {
        const sample = parseAccelSample(event.sysEvent.imuData as unknown, Date.now())
        applyImuPitch(pitchDegreesFromGravity(sample), { force: true })
        return
      }

      const ev = pickEvent(event)
      if (!ev) return
      const type = ev.eventType
      if (type === OsEventTypeList.CLICK_EVENT || type === undefined || type === null) {
        if (shouldIgnoreTemplePoseToggle({ imuSampleSeen, poseSource })) {
          return
        }
        poseSource = 'manual'
        dispatch({
          type: 'pose',
          pose: state.pose === 'lookUp' ? 'neutral' : 'lookUp',
        })
      }
    })

    try {
      await ensureImu(hub)
    } catch (err) {
      console.warn('[hudeck] imuControl failed', err)
    }

    window.addEventListener('pagehide', () => {
      void stopImu(hub!)
    })
  } else {
    console.info(READY_MARKER)
  }

  if (mockImuEnabled() || !hub) {
    startMockImu((sample) => {
      applyImuPitch(pitchDegreesFromGravity(sample))
    })
  }

  window.setInterval(() => {
    const prev = state
    state = reduce(state, { type: 'tick', nowMs: Date.now() }, Date.now())
    if (prev.confirm.status !== state.confirm.status) void paint(true)
    // Refresh elapsed (recording) and clock (idle / minimal-confirm deck).
    else if (state.pose === 'lookUp') void paint(false)
  }, 500)

  ;(window as unknown as { __hudeckDispatch?: (e: AppEvent) => void }).__hudeckDispatch =
    dispatch
}

void main()
