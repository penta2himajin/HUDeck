import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOOK_UP_THRESHOLD_DEG,
  LOOK_UP_THRESHOLDS_DEG,
  pitchDegreesFromGravity,
  resolveLookUpPose,
  rollDegreesFromGravity,
  type LookUpThresholdDeg,
} from './look-up-pose.ts'

describe('LOOK_UP_THRESHOLDS_DEG', () => {
  it('exposes switchable 15° and 20° options', () => {
    expect(LOOK_UP_THRESHOLDS_DEG).toEqual([15, 20])
    expect(DEFAULT_LOOK_UP_THRESHOLD_DEG).toBe(20)
  })
})

describe('pitchDegreesFromGravity', () => {
  /**
   * G2 accel is gravity-normalized. Rest looking ahead ≈ +z.
   * Positive pitch (look up / head back) increases +x — same axis as head-tilt tilt-B.
   */
  it('is ~0° at level rest (gravity on +z)', () => {
    expect(pitchDegreesFromGravity({ x: 0, y: 0, z: 1 })).toBeCloseTo(0, 5)
  })

  it('reports positive degrees when looking up (+x)', () => {
    // 30° toward +x: x=sin30, z=cos30
    const deg = pitchDegreesFromGravity({
      x: Math.sin((30 * Math.PI) / 180),
      y: 0,
      z: Math.cos((30 * Math.PI) / 180),
    })
    expect(deg).toBeCloseTo(30, 5)
  })

  it('reports negative degrees when looking down (−x)', () => {
    const deg = pitchDegreesFromGravity({
      x: -Math.sin((20 * Math.PI) / 180),
      y: 0,
      z: Math.cos((20 * Math.PI) / 180),
    })
    expect(deg).toBeCloseTo(-20, 5)
  })
})

describe('rollDegreesFromGravity', () => {
  it('is ~0° at level rest (gravity on +z)', () => {
    expect(rollDegreesFromGravity({ x: 0, y: 0, z: 1 })).toBeCloseTo(0, 5)
  })

  it('reports positive degrees for tilt-R (+y)', () => {
    const deg = rollDegreesFromGravity({
      x: 0,
      y: Math.sin((25 * Math.PI) / 180),
      z: Math.cos((25 * Math.PI) / 180),
    })
    expect(deg).toBeCloseTo(25, 5)
  })

  it('reports negative degrees for tilt-L (−y)', () => {
    const deg = rollDegreesFromGravity({
      x: 0,
      y: -Math.sin((15 * Math.PI) / 180),
      z: Math.cos((15 * Math.PI) / 180),
    })
    expect(deg).toBeCloseTo(-15, 5)
  })
})

describe('resolveLookUpPose', () => {
  it('enters lookUp at the configured threshold (20°)', () => {
    expect(
      resolveLookUpPose({
        pitchDeg: 19.9,
        thresholdDeg: 20,
        previous: 'neutral',
      }),
    ).toBe('neutral')
    expect(
      resolveLookUpPose({
        pitchDeg: 20,
        thresholdDeg: 20,
        previous: 'neutral',
      }),
    ).toBe('lookUp')
  })

  it('enters lookUp only at 15° when threshold is 15', () => {
    expect(
      resolveLookUpPose({
        pitchDeg: 14.9,
        thresholdDeg: 15,
        previous: 'neutral',
      }),
    ).toBe('neutral')
    expect(
      resolveLookUpPose({
        pitchDeg: 15,
        thresholdDeg: 15,
        previous: 'neutral',
      }),
    ).toBe('lookUp')
  })

  it('uses hysteresis so leaving lookUp requires dropping below threshold − 10°', () => {
    // 15° enter → exit below 5°
    expect(
      resolveLookUpPose({
        pitchDeg: 5.1,
        thresholdDeg: 15,
        previous: 'lookUp',
      }),
    ).toBe('lookUp')
    expect(
      resolveLookUpPose({
        pitchDeg: 4.9,
        thresholdDeg: 15,
        previous: 'lookUp',
      }),
    ).toBe('neutral')
    // 20° enter → exit below 10°
    expect(
      resolveLookUpPose({
        pitchDeg: 10.1,
        thresholdDeg: 20,
        previous: 'lookUp',
      }),
    ).toBe('lookUp')
    expect(
      resolveLookUpPose({
        pitchDeg: 9.9,
        thresholdDeg: 20,
        previous: 'lookUp',
      }),
    ).toBe('neutral')
  })

  it('accepts only the switchable threshold union', () => {
    const t: LookUpThresholdDeg = 15
    expect(LOOK_UP_THRESHOLDS_DEG.includes(t)).toBe(true)
  })
})
