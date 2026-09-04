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
  it('shows brand | clock | rule in title with no blank line, menu in body', () => {
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
