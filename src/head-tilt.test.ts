import { describe, expect, it } from 'vitest'
import {
  FIXED_CONTROL_TO_GESTURE,
  FIXED_GESTURE_TO_CONTROL,
  LOOKUP_HOLD_ENTER,
  LOOKUP_REACH_MS,
  LookUpTiltSession,
  NOD_DIP_DEG,
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

  it('fires tap on lookUp → dip ≥ −5° → return (nod)', () => {
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
