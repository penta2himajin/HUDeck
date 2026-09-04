import { describe, expect, it, beforeEach } from 'vitest'
import {
  CONFIRM_TIMEOUT_MS,
  COOLDOWN_AFTER_DISMISS_MS,
  COOLDOWN_AFTER_TIMEOUT_MS,
  MINIMAL_CONFIRM_LABEL,
  READY_MARKER,
  deriveGlassesView,
  formatElapsed,
  initialState,
  reduce,
  setNowProvider,
} from './state.ts'

describe('READY_MARKER', () => {
  it('matches the deskless smoke contract', () => {
    expect(READY_MARKER).toBe('[hudeck] ready')
  })
})

describe('formatElapsed', () => {
  it('formats mm:ss', () => {
    expect(formatElapsed(0)).toBe('0:00')
    expect(formatElapsed(65)).toBe('1:05')
  })
})

describe('confirm flow', () => {
  beforeEach(() => {
    setNowProvider(() => 1_000_000)
  })

  it('raises compact confirm on idle+neutral detect', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'conversationDetected' }, 100)
    expect(s.confirm).toMatchObject({ status: 'pending', tier: 'compact' })
    const view = deriveGlassesView(s, 100)
    expect(view.indicator).toBe(MINIMAL_CONFIRM_LABEL)
    expect(view.kind).toBe('confirm')
  })

  it('raises minimal confirm when detect while lookUp', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'pose', pose: 'lookUp' }, 0)
    s = reduce(s, { type: 'conversationDetected' }, 50)
    expect(s.confirm).toMatchObject({ status: 'pending', tier: 'minimal' })
    const view = deriveGlassesView(s, 50)
    expect(view.kind).toBe('deck')
    expect(view.indicator).toBe(MINIMAL_CONFIRM_LABEL)
    expect(view.title).toContain(MINIMAL_CONFIRM_LABEL)
    expect(view.title).toMatch(/\|\s*\d{2}:\d{2}\s*\|/)
    expect(view.body).toContain('▶ Record')
    expect(view.body).not.toContain('suggest')
  })

  it('demotes minimal to compact on lookDown, does not dismiss', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'pose', pose: 'lookUp' }, 0)
    s = reduce(s, { type: 'conversationDetected' }, 10)
    s = reduce(s, { type: 'pose', pose: 'neutral' }, 20)
    expect(s.confirm).toMatchObject({ status: 'pending', tier: 'compact' })
  })

  it('promotes compact to detail on lookUp and dismisses detail→neutral', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'conversationDetected' }, 10)
    s = reduce(s, { type: 'pose', pose: 'lookUp' }, 20)
    expect(s.confirm).toMatchObject({ status: 'pending', tier: 'detail', inspected: true })
    s = reduce(s, { type: 'pose', pose: 'neutral' }, 30)
    expect(s.confirm.status).toBe('inactive')
    expect(s.confirmCooldownUntilMs).toBe(30 + COOLDOWN_AFTER_DISMISS_MS)
  })

  it('accepts with nod from compact without detail', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'conversationDetected' }, 10)
    s = reduce(s, { type: 'nod' }, 20)
    expect(s.mode).toBe('recording')
    expect(s.confirm.status).toBe('inactive')
    expect(s.suggesting).toBe(true)
  })

  it('times out pending confirm with shorter cooldown', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'conversationDetected' }, 100)
    s = reduce(s, { type: 'tick', nowMs: 100 + CONFIRM_TIMEOUT_MS }, 100 + CONFIRM_TIMEOUT_MS)
    expect(s.confirm.status).toBe('inactive')
    expect(s.confirmCooldownUntilMs).toBe(100 + CONFIRM_TIMEOUT_MS + COOLDOWN_AFTER_TIMEOUT_MS)
  })

  it('does not raise confirm during chat', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'pose', pose: 'lookUp' }, 0)
    s = reduce(s, { type: 'openChat' }, 1)
    s = reduce(s, { type: 'conversationDetected' }, 2)
    expect(s.mode).toBe('chat')
    expect(s.confirm.status).toBe('inactive')
  })
})

describe('chat minimize', () => {
  it('keeps chat mode when looking down', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'pose', pose: 'lookUp' }, 0)
    s = reduce(s, { type: 'openChat' }, 1)
    s = reduce(s, { type: 'pose', pose: 'neutral' }, 2)
    expect(s.mode).toBe('chat')
    const view = deriveGlassesView(s, 2)
    expect(view.indicator).toBe('C')
    expect(view.body).toBe('')
  })
})

describe('idle lookUp deck', () => {
  it('exposes header+rule in title and menu in body (chrome packs them)', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'pose', pose: 'lookUp' }, 0)
    const view = deriveGlassesView(s, Date.UTC(2026, 0, 1, 15, 37))
    expect(view.kind).toBe('deck')
    const titleLines = view.title.split('\n')
    expect(titleLines).toHaveLength(2)
    expect(titleLines[0]).toContain('HUDeck')
    expect(titleLines[0]).toMatch(/\|\s*\d{2}:\d{2}\s*\|/)
    expect(titleLines[0]).not.toContain('REC')
    expect(titleLines[1]!.startsWith('━')).toBe(true)
    expect(view.body.split('\n')).toEqual(['▶ Record', '> Chat', '> Settings'])
    expect(view.body).not.toContain('suggest')
    expect(view.indicator).toBeNull()
  })
})

describe('recording views', () => {
  it('shows REC● indicator only at neutral', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'startRecordingActive' }, 1000)
    const neutral = deriveGlassesView(s, 5000)
    expect(neutral.indicator).toBe('REC●')
    expect(neutral.body).toBe('')
    s = reduce(s, { type: 'pose', pose: 'lookUp' }, 5000)
    const up = deriveGlassesView(s, 5000)
    expect(up.title).toContain('REC●')
    expect(up.body).toContain('suggest: on')
  })
})

describe('look-up settings', () => {
  beforeEach(() => {
    setNowProvider(() => 1_000_000)
  })

  it('defaults look-up threshold to 20°', () => {
    expect(initialState(0).lookUpThresholdDeg).toBe(20)
  })

  it('opens settings from idle lookUp and shows threshold picker', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'pose', pose: 'lookUp' }, 0)
    s = reduce(s, { type: 'openSettings' }, 1)
    expect(s.mode).toBe('settings')
    const view = deriveGlassesView(s, 1)
    expect(view.kind).toBe('settings')
    expect(view.title).toContain('Settings')
    expect(view.title).toMatch(/^Settings\n━/)
    expect(view.body.split('\n')).toEqual(['Look-up', '> 15°', '▶ 20°'])
    expect(view.indicator).toBeNull()
  })

  it('does not open settings unless idle lookUp without confirm', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'openSettings' }, 1)
    expect(s.mode).toBe('idle')

    s = reduce(s, { type: 'pose', pose: 'lookUp' }, 2)
    s = reduce(s, { type: 'conversationDetected' }, 3)
    s = reduce(s, { type: 'openSettings' }, 4)
    expect(s.mode).toBe('idle')
    expect(s.confirm.status).toBe('pending')
  })

  it('updates threshold selection and keeps settings mode', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'pose', pose: 'lookUp' }, 0)
    s = reduce(s, { type: 'openSettings' }, 1)
    s = reduce(s, { type: 'setLookUpThreshold', deg: 15 }, 2)
    expect(s.lookUpThresholdDeg).toBe(15)
    expect(s.mode).toBe('settings')
    const view = deriveGlassesView(s, 2)
    expect(view.body.split('\n')).toEqual(['Look-up', '▶ 15°', '> 20°'])
  })

  it('minimizes settings on lookDown and closes only via closeSettings', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'pose', pose: 'lookUp' }, 0)
    s = reduce(s, { type: 'openSettings' }, 1)
    s = reduce(s, { type: 'pose', pose: 'neutral' }, 2)
    expect(s.mode).toBe('settings')
    const minimized = deriveGlassesView(s, 2)
    expect(minimized.kind).toBe('settings')
    expect(minimized.indicator).toBe('S')
    expect(minimized.body).toBe('')

    s = reduce(s, { type: 'closeSettings' }, 3)
    expect(s.mode).toBe('idle')
  })

  it('does not raise confirm during settings', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'pose', pose: 'lookUp' }, 0)
    s = reduce(s, { type: 'openSettings' }, 1)
    s = reduce(s, { type: 'conversationDetected' }, 2)
    expect(s.mode).toBe('settings')
    expect(s.confirm.status).toBe('inactive')
  })

  it('allows setLookUpThreshold from idle without opening settings', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'setLookUpThreshold', deg: 15 }, 1)
    expect(s.lookUpThresholdDeg).toBe(15)
    expect(s.mode).toBe('idle')
  })
})

describe('lookUp head-tilt controls', () => {
  beforeEach(() => {
    setNowProvider(() => 1_000_000)
  })

  it('ignores controls unless pose is lookUp', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'control', control: 'swipe-down' }, 1)
    expect(s.menuIndex).toBe(0)
  })

  it('moves deck selection with swipe-up / swipe-down while lookUp', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'pose', pose: 'lookUp' }, 0)
    s = reduce(s, { type: 'control', control: 'swipe-down' }, 1)
    expect(s.menuIndex).toBe(1)
    let view = deriveGlassesView(s, 1)
    expect(view.body.split('\n')).toEqual(['> Record', '▶ Chat', '> Settings'])

    s = reduce(s, { type: 'control', control: 'swipe-down' }, 2)
    expect(s.menuIndex).toBe(2)
    s = reduce(s, { type: 'control', control: 'swipe-up' }, 3)
    expect(s.menuIndex).toBe(1)
  })

  it('activates selection with tap (tilt-F) and backs out with dbl (tilt-B)', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'pose', pose: 'lookUp' }, 0)
    s = reduce(s, { type: 'control', control: 'swipe-down' }, 1) // Chat
    s = reduce(s, { type: 'control', control: 'swipe-down' }, 2) // Settings
    s = reduce(s, { type: 'control', control: 'tap' }, 3)
    expect(s.mode).toBe('settings')

    s = reduce(s, { type: 'control', control: 'dbl' }, 4)
    expect(s.mode).toBe('idle')
    expect(s.pose).toBe('lookUp')
  })

  it('accepts pending confirm with tap while lookUp', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'pose', pose: 'lookUp' }, 0)
    s = reduce(s, { type: 'conversationDetected' }, 1)
    s = reduce(s, { type: 'control', control: 'tap' }, 2)
    expect(s.mode).toBe('recording')
    expect(s.confirm.status).toBe('inactive')
  })

  it('cycles look-up threshold in settings via swipe', () => {
    let s = initialState(0)
    s = reduce(s, { type: 'pose', pose: 'lookUp' }, 0)
    s = reduce(s, { type: 'openSettings' }, 1)
    expect(s.lookUpThresholdDeg).toBe(20)
    s = reduce(s, { type: 'control', control: 'swipe-up' }, 2)
    expect(s.lookUpThresholdDeg).toBe(15)
    const view = deriveGlassesView(s, 2)
    expect(view.body).toContain('▶ 15°')
  })
})
