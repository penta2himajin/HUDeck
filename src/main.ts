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
import {
  LOOKUP_HOLD_ENTER,
  LOOKUP_REACH_MS,
  LookUpTiltSession,
  NOD_DIP_DEG,
  NOD_ROLL_MAX_DEG,
  type ControlId,
} from './head-tilt.ts'
import { parseAccelSample, type AccelSample } from './imu-parse.ts'
import {
  debugSend,
  debugSendImu,
  startDebugTelemetry,
} from './debug-telemetry.ts'
import {
  DEFAULT_LOOK_UP_THRESHOLD_DEG,
  LOOK_UP_EXIT_ROLL_GUARD_DEG,
  isLookUpThresholdDeg,
  pitchDegreesFromGravity,
  resolveLookUpPose,
  rollDegreesFromGravity,
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

function templeControl(type: OsEventTypeList | undefined | null): ControlId | null {
  if (type === OsEventTypeList.CLICK_EVENT || type === undefined || type === null) {
    return 'tap'
  }
  if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) return 'dbl'
  if (type === OsEventTypeList.SCROLL_TOP_EVENT) return 'swipe-up'
  if (type === OsEventTypeList.SCROLL_BOTTOM_EVENT) return 'swipe-down'
  return null
}

async function main() {
  startDebugTelemetry()
  debugSend('app', 'boot', {
    holdEnter: LOOKUP_HOLD_ENTER,
    reachMs: LOOKUP_REACH_MS,
    nodDipDeg: NOD_DIP_DEG,
    nodRollMaxDeg: NOD_ROLL_MAX_DEG,
    exitRollGuardDeg: LOOK_UP_EXIT_ROLL_GUARD_DEG,
  })

  const root = document.querySelector('#app')
  if (!(root instanceof HTMLElement)) throw new Error('#app missing')
  let state: AppState = initialState(Date.now(), {
    lookUpThresholdDeg: loadThreshold(),
  })
  let lastViewKey = ''
  let pitchDeg: number | null = null
  let rollDeg: number | null = null
  let lastGravity: AccelSample | null = null
  let poseSource: PhoneImuStatus['source'] = 'none'
  let imuSampleSeen = false
  let imuOpen = false
  let hub: EvenAppBridge | null = null
  const tiltSession = new LookUpTiltSession()

  const imuStatus = (): PhoneImuStatus => ({
    pitchDeg,
    rollDeg,
    thresholdDeg: state.lookUpThresholdDeg,
    source: poseSource,
    tiltArmed: tiltSession.isArmed(),
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

  function syncTiltArm(pose: AppState['pose'], sample: AccelSample | null) {
    if (pose === 'lookUp' && sample) {
      if (!tiltSession.isArmed()) tiltSession.arm(sample)
    } else if (pose !== 'lookUp') {
      tiltSession.disarm()
    }
  }

  function dispatch(event: AppEvent) {
    const beforeMode = state.mode
    const beforeConfirm = state.confirm.status
    const beforePose = state.pose
    const beforeMenu = state.menuIndex
    const beforeThr = state.lookUpThresholdDeg
    state = reduce(state, event, Date.now())
    if (beforePose !== state.pose) {
      syncTiltArm(state.pose, lastGravity)
      debugSend('glasses', 'pose', {
        from: beforePose,
        to: state.pose,
        pitchDeg,
        rollDeg,
        via: event.type,
      })
    }
    if (event.type === 'control') {
      debugSend('app', 'control', {
        control: event.control,
        mode: state.mode,
        menuIndex: state.menuIndex,
        tilt: tiltSession.telemetry(lastGravity ?? undefined),
      })
    }
    if (event.type === 'setLookUpThreshold' || beforeThr !== state.lookUpThresholdDeg) {
      saveThreshold(state.lookUpThresholdDeg)
      debugSend('app', 'threshold', { deg: state.lookUpThresholdDeg })
    }
    const structural =
      beforeMode !== state.mode ||
      beforeConfirm !== state.confirm.status ||
      beforePose !== state.pose ||
      beforeMenu !== state.menuIndex ||
      (state.confirm.status === 'pending' && event.type === 'pose')
    if (beforeMode !== state.mode || beforeMenu !== state.menuIndex) {
      debugSend('app', 'state', {
        mode: state.mode,
        menuIndex: state.menuIndex,
        confirm: state.confirm.status,
      })
    }
    void paint(structural)
  }

  function emitTiltTelemetry(sample: AccelSample, control: ControlId | null) {
    const lookUp = state.pose === 'lookUp'
    debugSendImu(sample, { lookUp, force: lookUp })
    if (lookUp) {
      debugSend('glasses', 'tilt', {
        ...tiltSession.telemetry(sample),
        fired: control,
        thrDeg: state.lookUpThresholdDeg,
        poseSource,
      })
    }
  }

  function applyImuSample(sample: AccelSample, opts: { force?: boolean } = {}) {
    imuSampleSeen = true
    lastGravity = sample
    pitchDeg = pitchDegreesFromGravity(sample)
    rollDeg = rollDegreesFromGravity(sample)
    // Manual pose buttons win over mock rest ticks until mock↑/mock→ (force) or real intent.
    if (poseSource === 'manual' && !opts.force) {
      if (state.pose === 'lookUp') {
        const control = tiltSession.push(sample)
        emitTiltTelemetry(sample, control)
        if (control) dispatch({ type: 'control', control })
        else void paint(false)
      } else {
        debugSendImu(sample, { lookUp: false })
        void paint(false)
      }
      return
    }
    poseSource = 'imu'
    const nextPose = resolveLookUpPose({
      pitchDeg,
      rollDeg,
      thresholdDeg: state.lookUpThresholdDeg,
      previous: state.pose,
    })
    if (nextPose !== state.pose) {
      if (nextPose === 'lookUp') tiltSession.arm(sample)
      else tiltSession.disarm()
      emitTiltTelemetry(sample, null)
      dispatch({ type: 'pose', pose: nextPose })
      return
    }
    if (state.pose === 'lookUp') {
      if (!tiltSession.isArmed()) tiltSession.arm(sample)
      const control = tiltSession.push(sample)
      emitTiltTelemetry(sample, control)
      if (control) {
        console.info(`[hudeck] control:${control} via tilt`)
        dispatch({ type: 'control', control })
        return
      }
    } else {
      tiltSession.disarm()
      debugSendImu(sample, { lookUp: false })
    }
    void paint(false)
  }

  const phone = createPhoneUi(root, {
    onPoseNeutral: () => {
      const g = gravityAtPitchDeg(0)
      window.__hudeckInjectImu?.(g.x, g.y, g.z)
      poseSource = 'manual'
      pitchDeg = 0
      rollDeg = 0
      lastGravity = { ...g, t: Date.now() }
      tiltSession.disarm()
      dispatch({ type: 'pose', pose: 'neutral' })
    },
    onPoseLookUp: () => {
      const g = gravityAtPitchDeg(state.lookUpThresholdDeg + 5)
      window.__hudeckInjectImu?.(g.x, g.y, g.z)
      poseSource = 'manual'
      pitchDeg = pitchDegreesFromGravity(g)
      rollDeg = rollDegreesFromGravity(g)
      lastGravity = { ...g, t: Date.now() }
      tiltSession.arm(lastGravity)
      dispatch({ type: 'pose', pose: 'lookUp' })
    },
    onDetect: () => dispatch({ type: 'conversationDetected' }),
    onNod: () => dispatch({ type: 'nod' }),
    onControl: (control) => dispatch({ type: 'control', control }),
    onRecord: () => dispatch({ type: 'startRecordingActive' }),
    onStop: () => dispatch({ type: 'stopRecording' }),
    onOpenChat: () => dispatch({ type: 'openChat' }),
    onCloseChat: () => dispatch({ type: 'closeChat' }),
    onOpenSettings: () => dispatch({ type: 'openSettings' }),
    onCloseSettings: () => dispatch({ type: 'closeSettings' }),
    onThreshold: (deg) => {
      dispatch({ type: 'setLookUpThreshold', deg })
      if (lastGravity != null) applyImuSample(lastGravity)
      else if (pitchDeg != null) {
        // Re-resolve pose with the new threshold using last pitch.
        const nextPose = resolveLookUpPose({
          pitchDeg,
          rollDeg: rollDeg ?? 0,
          thresholdDeg: deg,
          previous: state.pose,
        })
        if (nextPose !== state.pose) dispatch({ type: 'pose', pose: nextPose })
        else void paint(false)
      } else void paint(false)
    },
    onMockLookUp: () => {
      const g = gravityAtPitchDeg(state.lookUpThresholdDeg + 5)
      window.__hudeckInjectImu?.(g.x, g.y, g.z)
      applyImuSample({ ...g, t: Date.now() }, { force: true })
    },
    onMockNeutral: () => {
      const g = gravityAtPitchDeg(0)
      window.__hudeckInjectImu?.(g.x, g.y, g.z)
      applyImuSample({ ...g, t: Date.now() }, { force: true })
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
        applyImuSample(sample, { force: true })
        return
      }

      const ev = pickEvent(event)
      if (!ev) return
      const type = ev.eventType
      const control = templeControl(type)

      if (state.pose === 'lookUp' && control) {
        console.info(`[hudeck] control:${control} via temple`)
        dispatch({ type: 'control', control })
        return
      }

      // Before IMU: temple click toggles pose for deskless sim.
      if (
        (type === OsEventTypeList.CLICK_EVENT || type === undefined || type === null) &&
        !shouldIgnoreTemplePoseToggle({ imuSampleSeen, poseSource })
      ) {
        poseSource = 'manual'
        const next = state.pose === 'lookUp' ? 'neutral' : 'lookUp'
        if (next === 'lookUp' && lastGravity) tiltSession.arm(lastGravity)
        else tiltSession.disarm()
        dispatch({ type: 'pose', pose: next })
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
      applyImuSample(sample)
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
