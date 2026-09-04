import { describe, expect, it } from 'vitest'
import {
  FIXED_CONTROL_TO_TILT,
  FIXED_TILT_TO_CONTROL,
  LOOKUP_HOLD_ENTER,
  LOOKUP_REACH_MS,
  LookUpTiltSession,
  controlForTilt,
  holdFromLookUpOffset,
} from './head-tilt.ts'

describe('fixed tilt ↔ control map', () => {
  it('matches head-tilt-control defaults', () => {
    expect(FIXED_TILT_TO_CONTROL).toEqual({
      'tilt-F': 'tap',
      'tilt-B': 'dbl',
      'tilt-L': 'swipe-up',
      'tilt-R': 'swipe-down',
    })
    expect(FIXED_CONTROL_TO_TILT.tap).toBe('tilt-F')
    expect(controlForTilt('tilt-L')).toBe('swipe-up')
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

  it('ignores small offsets inside the band', () => {
    expect(holdFromLookUpOffset({ x: 0.1, y: 0, z: 0 })).toBeNull()
  })
})

describe('LookUpTiltSession', () => {
  it('emits nothing until armed with a lookUp baseline', () => {
    const s = new LookUpTiltSession()
    expect(s.push({ x: 0, y: 0.4, z: 0.9, t: 0 })).toBeNull()
    expect(s.isArmed()).toBe(false)
  })

  it('fires tap after dwell on tilt-F relative to lookUp baseline', () => {
    const s = new LookUpTiltSession()
    // lookUp rest ≈ gravity already pitched (+x); baseline snaps here.
    s.arm({ x: 0.35, y: 0, z: 0.94, t: 0 })
    expect(s.push({ x: 0.35, y: 0, z: 0.94, t: 10 })).toBeNull()
    // chin toward display (−x vs lookUp) = tilt-F
    expect(s.push({ x: 0.35 - 0.35, y: 0, z: 0.94, t: 20 })).toBeNull()
    expect(s.push({ x: 0.0, y: 0, z: 0.94, t: 20 + LOOKUP_REACH_MS })).toBe(
      'tap',
    )
  })

  it('fires swipe-down on tilt-R and ignores after disarm', () => {
    const s = new LookUpTiltSession()
    s.arm({ x: 0.35, y: 0, z: 0.94, t: 0 })
    s.push({ x: 0.35, y: 0.35, z: 0.94, t: 10 })
    expect(s.push({ x: 0.35, y: 0.35, z: 0.94, t: 10 + LOOKUP_REACH_MS })).toBe(
      'swipe-down',
    )
    s.disarm()
    expect(s.push({ x: 0.35, y: 0.35, z: 0.94, t: 500 })).toBeNull()
  })

  it('maps tilt-B / tilt-L to dbl / swipe-up', () => {
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
})
