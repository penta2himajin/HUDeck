import { describe, expect, it } from 'vitest'
import {
  FIXED_CONTROL_TO_GESTURE,
  FIXED_GESTURE_TO_CONTROL,
  LOOKUP_HOLD_ENTER,
  LOOKUP_EXEC_COOLDOWN_MS,
  LOOKUP_REACH_MS,
  LOOKUP_ROLL_REARM_DROP,
  LookUpTiltSession,
  NOD_DIP_DEG,
  NOD_ROLL_MAX_DEG,
  holdFromLookUpOffset,
} from './head-tilt.ts'
import { gravityAtPitchDeg } from './mock-imu.ts'

/** Gravity at lookUp pitch with an added pitch delta (degrees). */
function atPitch(basePitchDeg: number, deltaDeg = 0, rollDeg = 0) {
  const pitch = ((basePitchDeg + deltaDeg) * Math.PI) / 180
  const roll = (rollDeg * Math.PI) / 180
  // Compose: start from +z, apply pitch about y then roll about x' — for tests
  // we use the same convention as gravityAtPitchDeg for pitch-only, and
  // atan2(y,z) roll when rollDeg ≠ 0 on a pitched frame.
  const x = Math.sin(pitch)
  const z0 = Math.cos(pitch)
  const y = Math.sin(roll) * z0
  const z = Math.cos(roll) * z0
  return { x, y, z }
}

describe('fixed gesture ↔ control map', () => {
  it('maps nod→tap and holds→dbl/swipe (not tilt-F hold→tap)', () => {
    expect(FIXED_GESTURE_TO_CONTROL).toEqual({
      nod: 'tap',
      'tilt-B': 'dbl',
      'tilt-L': 'swipe-up',
      'tilt-R': 'swipe-down',
    })
    expect(FIXED_CONTROL_TO_GESTURE.tap).toBe('nod')
  })
})

describe('hold sensitivity defaults', () => {
  it('uses enter 0.20 and dwell 100ms', () => {
    expect(LOOKUP_HOLD_ENTER).toBe(0.2)
    expect(LOOKUP_REACH_MS).toBe(100)
  })
})

describe('holdFromLookUpOffset', () => {
  it('classifies pitch/roll vs lookUp baseline', () => {
    expect(holdFromLookUpOffset({ x: -LOOKUP_HOLD_ENTER, y: 0, z: 0 })).toBe(
      'tilt-F',
    )
    expect(holdFromLookUpOffset({ x: LOOKUP_HOLD_ENTER, y: 0, z: 0 })).toBe(
      'tilt-B',
    )
    expect(holdFromLookUpOffset({ x: 0, y: -LOOKUP_HOLD_ENTER, z: 0 })).toBe(
      'tilt-L',
    )
    expect(holdFromLookUpOffset({ x: 0, y: LOOKUP_HOLD_ENTER, z: 0 })).toBe(
      'tilt-R',
    )
  })
})

describe('LookUpTiltSession nod→tap', () => {
  const basePitch = 25

  it('emits nothing until armed', () => {
    const s = new LookUpTiltSession()
    expect(s.push({ ...atPitch(basePitch, -8), t: 0 })).toBeNull()
  })

  it('fires tap on lookUp → dip ≥ −5° → return (nod) with near-neutral roll', () => {
    const s = new LookUpTiltSession()
    const base = atPitch(basePitch)
    s.arm({ ...base, t: 0 })
    expect(s.push({ ...base, t: 10 })).toBeNull()
    // Dip more than NOD_DIP_DEG below baseline pitch.
    expect(s.push({ ...atPitch(basePitch, -(NOD_DIP_DEG + 1)), t: 50 })).toBeNull()
    expect(s.push({ ...atPitch(basePitch, -(NOD_DIP_DEG + 3)), t: 80 })).toBeNull()
    // Return to lookUp baseline → one tap.
    expect(s.push({ ...base, t: 120 })).toBe('tap')
  })

  it('does not fire tap for a shallow dip under 5°', () => {
    const s = new LookUpTiltSession()
    const base = atPitch(basePitch)
    s.arm({ ...base, t: 0 })
    s.push({ ...atPitch(basePitch, -3), t: 20 })
    expect(s.push({ ...base, t: 40 })).toBeNull()
  })

  it('does not start nod when |Δroll| exceeds NOD_ROLL_MAX_DEG (tilt-L/R wins)', () => {
    expect(NOD_ROLL_MAX_DEG).toBeLessThan(12)
    const s = new LookUpTiltSession()
    const base = atPitch(basePitch)
    s.arm({ ...base, t: 0 })
    // Pitch dip with large roll → not a nod; hold path may reach instead.
    expect(
      s.push({
        ...atPitch(basePitch, -(NOD_DIP_DEG + 2), NOD_ROLL_MAX_DEG + 4),
        t: 20,
      }),
    ).toBeNull()
    expect(s.status().nodActive).toBe(false)
    // Return with roll still large must not fire tap.
    expect(
      s.push({ ...atPitch(basePitch, 0, NOD_ROLL_MAX_DEG + 4), t: 40 }),
    ).not.toBe('tap')
  })

  it('cancels an unfinished nod when roll leaves the nod window', () => {
    const s = new LookUpTiltSession()
    const base = atPitch(basePitch)
    s.arm({ ...base, t: 0 })
    s.push({ ...atPitch(basePitch, -(NOD_DIP_DEG + 2)), t: 20 })
    expect(s.status().nodActive).toBe(true)
    s.push({
      ...atPitch(basePitch, -(NOD_DIP_DEG + 2), NOD_ROLL_MAX_DEG + 5),
      t: 40,
    })
    expect(s.status().nodActive).toBe(false)
    expect(s.push({ ...base, t: 60 })).toBeNull()
  })

  it('does not cancel tilt-L/R reach when pitch wobbles during a roll hold', () => {
    const s = new LookUpTiltSession()
    s.arm({ x: 0.35, y: 0, z: 0.94, t: 0 })
    s.push({ x: 0.35, y: 0.35, z: 0.94, t: 10 })
    expect(s.status().reaching).toBe('tilt-R')
    // Pitch drops a bit while roll stays in hold — must not clear reach via nod.
    s.push({ x: 0.28, y: 0.35, z: 0.94, t: 50 })
    expect(s.status().nodActive).toBe(false)
    expect(s.status().reaching).toBe('tilt-R')
    expect(s.push({ x: 0.35, y: 0.35, z: 0.94, t: 10 + LOOKUP_REACH_MS })).toBe(
      'swipe-down',
    )
  })

  it('does not fire tap on tilt-F hold dwell (nod required)', () => {
    const s = new LookUpTiltSession()
    // Use accel offset large enough for tilt-F hold classification.
    s.arm({ x: 0.35, y: 0, z: 0.94, t: 0 })
    s.push({ x: 0.0, y: 0, z: 0.94, t: 10 })
    expect(s.push({ x: 0.0, y: 0, z: 0.94, t: 10 + LOOKUP_REACH_MS })).toBeNull()
  })

  it('fires swipe-down on tilt-R hold and ignores after disarm', () => {
    const s = new LookUpTiltSession()
    s.arm({ x: 0.35, y: 0, z: 0.94, t: 0 })
    s.push({ x: 0.35, y: 0.35, z: 0.94, t: 10 })
    expect(s.push({ x: 0.35, y: 0.35, z: 0.94, t: 10 + LOOKUP_REACH_MS })).toBe(
      'swipe-down',
    )
    s.disarm()
    expect(s.push({ x: 0.35, y: 0.35, z: 0.94, t: 500 })).toBeNull()
  })

  it('maps tilt-B / tilt-L holds to dbl / swipe-up', () => {
    const s = new LookUpTiltSession()
    s.arm({ x: 0.35, y: 0, z: 0.94, t: 0 })
    s.push({ x: 0.35 + 0.35, y: 0, z: 0.94, t: 1 })
    expect(s.push({ x: 0.7, y: 0, z: 0.94, t: 1 + LOOKUP_REACH_MS })).toBe('dbl')

    s.disarm()
    s.arm({ x: 0.35, y: 0, z: 0.94, t: 1000 })
    s.push({ x: 0.35, y: -0.35, z: 0.94, t: 1001 })
    expect(
      s.push({ x: 0.35, y: -0.35, z: 0.94, t: 1001 + LOOKUP_REACH_MS }),
    ).toBe('swipe-up')
  })

  it('rearms tilt-R after easing back from roll peak without full neutral', () => {
    const s = new LookUpTiltSession()
    s.arm({ x: 0.35, y: 0, z: 0.94, t: 0 })
    s.push({ x: 0.35, y: 0.35, z: 0.94, t: 10 })
    expect(s.push({ x: 0.35, y: 0.35, z: 0.94, t: 10 + LOOKUP_REACH_MS })).toBe(
      'swipe-down',
    )
    // Still far from neutral — must not re-fire while held at peak.
    expect(
      s.push({
        x: 0.35,
        y: 0.35,
        z: 0.94,
        t: 10 + LOOKUP_REACH_MS + LOOKUP_EXEC_COOLDOWN_MS + 20,
      }),
    ).toBeNull()
    // Ease back from peak by ≥ LOOKUP_ROLL_REARM_DROP, still above enter.
    const eased = 0.35 - LOOKUP_ROLL_REARM_DROP
    expect(eased).toBeGreaterThan(LOOKUP_HOLD_ENTER)
    expect(s.push({ x: 0.35, y: eased, z: 0.94, t: 400 })).toBeNull()
    expect(s.status().held).toBeNull()
    // Holding the eased trough must not auto-fire — need a rising pulse.
    expect(
      s.push({
        x: 0.35,
        y: eased,
        z: 0.94,
        t: 400 + LOOKUP_REACH_MS + LOOKUP_EXEC_COOLDOWN_MS,
      }),
    ).toBeNull()
    // Pulse outward again → second swipe without visiting neutral.
    s.push({ x: 0.35, y: 0.35, z: 0.94, t: 700 })
    expect(s.push({ x: 0.35, y: 0.35, z: 0.94, t: 700 + LOOKUP_REACH_MS })).toBe(
      'swipe-down',
    )
  })

  it('does not peak-rearm tilt-B (still needs neutral to repeat dbl)', () => {
    const s = new LookUpTiltSession()
    s.arm({ x: 0.35, y: 0, z: 0.94, t: 0 })
    s.push({ x: 0.7, y: 0, z: 0.94, t: 1 })
    expect(s.push({ x: 0.7, y: 0, z: 0.94, t: 1 + LOOKUP_REACH_MS })).toBe('dbl')
    // Ease pitch back a lot but stay above enter — dbl stays locked.
    expect(s.push({ x: 0.55, y: 0, z: 0.94, t: 200 })).toBeNull()
    expect(s.status().held).toBe('tilt-B')
    expect(s.push({ x: 0.7, y: 0, z: 0.94, t: 300 })).toBeNull()
  })

  it('keeps lookUp-relative nod usable with gravityAtPitchDeg helper', () => {
    const s = new LookUpTiltSession()
    const base = gravityAtPitchDeg(25)
    s.arm({ ...base, t: 0 })
    const dipped = gravityAtPitchDeg(25 - 8)
    expect(s.push({ ...dipped, t: 30 })).toBeNull()
    expect(s.push({ ...base, t: 60 })).toBe('tap')
  })

  it('exposes tilt telemetry for debug-ws', () => {
    const s = new LookUpTiltSession()
    const base = gravityAtPitchDeg(25)
    s.arm({ ...base, t: 0 })
    const tel = s.telemetry({ ...gravityAtPitchDeg(25 - 6), t: 1 })
    expect(tel.armed).toBe(true)
    expect(tel.holdEnter).toBe(LOOKUP_HOLD_ENTER)
    expect(tel.reachMs).toBe(LOOKUP_REACH_MS)
    expect(tel.deltaPitchDeg).toBeCloseTo(-6, 0)
  })
})
