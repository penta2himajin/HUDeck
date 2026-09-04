import {
  DECK_MENU_RECORD,
  REC_DOT_LABEL,
  formatClockHm,
  formatDeckBody,
  formatDeckTitle,
} from './deck-chrome.ts'

/** Core interaction types for HUDeck (pure, unit-tested). */


export type AppMode = 'idle' | 'recording' | 'chat'
export type Pose = 'neutral' | 'lookUp'
export type ConfirmTier = 'minimal' | 'compact' | 'detail'

export type ConfirmState =
  | { status: 'inactive' }
  | {
      status: 'pending'
      tier: ConfirmTier
      /** True after the user opened detail at least once this prompt. */
      inspected: boolean
      startedAtMs: number
    }

export type AppState = {
  mode: AppMode
  pose: Pose
  confirm: ConfirmState
  suggesting: boolean
  /** Explicit suggest-armed; recording also forces suggesting on. */
  suggestArmed: boolean
  /** Earliest ms when a new confirm may be raised. */
  confirmCooldownUntilMs: number
  recordingStartedAtMs: number | null
}

export const CONFIRM_TIMEOUT_MS = 12_000
export const COOLDOWN_AFTER_DISMISS_MS = 3 * 60_000
export const COOLDOWN_AFTER_TIMEOUT_MS = 90_000

export const MINIMAL_CONFIRM_LABEL = 'REC?'
export const READY_MARKER = '[hudeck] ready'

export function initialState(nowMs = 0): AppState {
  return {
    mode: 'idle',
    pose: 'neutral',
    confirm: { status: 'inactive' },
    suggesting: false,
    suggestArmed: false,
    confirmCooldownUntilMs: 0,
    recordingStartedAtMs: null,
  }
}

export type AppEvent =
  | { type: 'pose'; pose: Pose }
  | { type: 'conversationDetected' }
  | { type: 'nod' }
  | { type: 'startRecordingActive' }
  | { type: 'stopRecording' }
  | { type: 'openChat' }
  | { type: 'closeChat' }
  | { type: 'tick'; nowMs: number }
  | { type: 'dismissConfirm' }

function clearConfirm(
  state: AppState,
  nowMs: number,
  cooldownMs: number,
): AppState {
  return {
    ...state,
    confirm: { status: 'inactive' },
    confirmCooldownUntilMs: nowMs + cooldownMs,
  }
}

function beginConfirm(state: AppState, nowMs: number): AppState {
  if (state.mode !== 'idle') return state
  if (state.confirm.status === 'pending') return state
  if (nowMs < state.confirmCooldownUntilMs) return state

  const tier: ConfirmTier = state.pose === 'lookUp' ? 'minimal' : 'compact'
  return {
    ...state,
    confirm: {
      status: 'pending',
      tier,
      inspected: false,
      startedAtMs: nowMs,
    },
  }
}

function acceptConfirm(state: AppState, nowMs: number): AppState {
  if (state.confirm.status !== 'pending') return state
  return {
    ...state,
    mode: 'recording',
    confirm: { status: 'inactive' },
    suggesting: true,
    recordingStartedAtMs: nowMs,
  }
}

function applyPose(state: AppState, pose: Pose, nowMs: number): AppState {
  if (state.pose === pose) return state
  const next: AppState = { ...state, pose }

  if (state.confirm.status !== 'pending') return next

  const { tier, inspected } = state.confirm

  // detail → neutral => dismiss
  if (tier === 'detail' && pose === 'neutral') {
    return clearConfirm({ ...next, pose }, nowMs, COOLDOWN_AFTER_DISMISS_MS)
  }

  // minimal (lookUp interrupt) → neutral => demote to compact
  if (tier === 'minimal' && pose === 'neutral') {
    return {
      ...next,
      confirm: {
        status: 'pending',
        tier: 'compact',
        inspected,
        startedAtMs: state.confirm.startedAtMs,
      },
    }
  }

  // compact → lookUp => detail (inspect)
  if (tier === 'compact' && pose === 'lookUp') {
    return {
      ...next,
      confirm: {
        status: 'pending',
        tier: 'detail',
        inspected: true,
        startedAtMs: state.confirm.startedAtMs,
      },
    }
  }

  return next
}

/** Injectable clock for reduce() default nowMs (tests). */
let nowProvider: () => number = () => Date.now()

export function setNowProvider(fn: () => number): void {
  nowProvider = fn
}

export function reduce(state: AppState, event: AppEvent, nowMs = nowProvider()): AppState {
  switch (event.type) {
    case 'pose':
      return applyPose(state, event.pose, nowMs)
    case 'conversationDetected':
      return beginConfirm(state, nowMs)
    case 'nod':
      if (state.confirm.status === 'pending') return acceptConfirm(state, nowMs)
      return state
    case 'startRecordingActive':
      if (state.mode !== 'idle') return state
      return {
        ...state,
        mode: 'recording',
        confirm: { status: 'inactive' },
        suggesting: true,
        recordingStartedAtMs: nowMs,
      }
    case 'stopRecording':
      if (state.mode !== 'recording') return state
      return {
        ...state,
        mode: 'idle',
        suggesting: state.suggestArmed,
        recordingStartedAtMs: null,
      }
    case 'openChat':
      if (state.mode !== 'idle' || state.confirm.status === 'pending') return state
      if (state.pose !== 'lookUp') return state
      return { ...state, mode: 'chat', suggesting: false }
    case 'closeChat':
      if (state.mode !== 'chat') return state
      return { ...state, mode: 'idle' }
    case 'dismissConfirm':
      if (state.confirm.status !== 'pending') return state
      return clearConfirm(state, nowMs, COOLDOWN_AFTER_DISMISS_MS)
    case 'tick': {
      if (state.confirm.status !== 'pending') return state
      if (event.nowMs - state.confirm.startedAtMs < CONFIRM_TIMEOUT_MS) return state
      return clearConfirm(state, event.nowMs, COOLDOWN_AFTER_TIMEOUT_MS)
    }
    default:
      return state
  }
}

export type GlassesView = {
  kind: 'blank' | 'deck' | 'confirm' | 'recording' | 'chat'
  title: string
  body: string
  indicator: string | null
}

export function deriveGlassesView(state: AppState, nowMs = nowProvider()): GlassesView {
  if (state.confirm.status === 'pending') {
    if (state.confirm.tier === 'minimal') {
      return {
        kind: 'deck',
        title: formatDeckTitle({
          timeHm: formatClockHm(new Date(nowMs)),
          rightSlot: MINIMAL_CONFIRM_LABEL,
        }),
        body: formatDeckBody({ selectedIndex: DECK_MENU_RECORD }),
        indicator: MINIMAL_CONFIRM_LABEL,
      }
    }
    if (state.confirm.tier === 'compact') {
      return {
        kind: 'confirm',
        title: MINIMAL_CONFIRM_LABEL,
        body: 'nod=rec  lookUp=detail',
        indicator: MINIMAL_CONFIRM_LABEL,
      }
    }
    return {
      kind: 'confirm',
      title: 'Record?',
      body: 'Conversation-like audio\nnod=start  lookDown=dismiss',
      indicator: MINIMAL_CONFIRM_LABEL,
    }
  }

  if (state.mode === 'recording') {
    const elapsedSec =
      state.recordingStartedAtMs == null
        ? 0
        : Math.max(0, Math.floor((nowMs - state.recordingStartedAtMs) / 1000))
    if (state.pose === 'neutral') {
      return {
        kind: 'recording',
        title: '',
        body: '',
        indicator: REC_DOT_LABEL,
      }
    }
    return {
      kind: 'recording',
      title: `${REC_DOT_LABEL} ${formatElapsed(elapsedSec)}`,
      body: state.suggesting ? 'suggest: on\n(transcript placeholder)' : '(transcript placeholder)',
      indicator: REC_DOT_LABEL,
    }
  }

  if (state.mode === 'chat') {
    if (state.pose === 'neutral') {
      return {
        kind: 'chat',
        title: '',
        body: '',
        indicator: 'C',
      }
    }
    return {
      kind: 'chat',
      title: 'Chat',
      body: 'omochat placeholder\nclose from deck later',
      indicator: 'C',
    }
  }

  // idle
  if (state.pose === 'lookUp') {
    return {
      kind: 'deck',
      title: formatDeckTitle({
        timeHm: formatClockHm(new Date(nowMs)),
      }),
      body: formatDeckBody({ selectedIndex: DECK_MENU_RECORD }),
      indicator: null,
    }
  }

  return {
    kind: 'blank',
    title: '',
    body: '',
    indicator: null,
  }
}

export function formatElapsed(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatPhoneSummary(state: AppState, view: GlassesView): string {
  const confirm =
    state.confirm.status === 'pending'
      ? `confirm:${state.confirm.tier}`
      : 'confirm:off'
  return [
    'HUDeck',
    `mode:${state.mode} pose:${state.pose}`,
    confirm,
    `suggesting:${state.suggesting ? 'on' : 'off'}`,
    `view:${view.kind}`,
    view.indicator ? `indicator:${view.indicator}` : 'indicator:-',
    view.title ? `title:${view.title}` : '',
    view.body,
  ]
    .filter(Boolean)
    .join('\n')
}
