import type { Pose } from './state.ts'

/** Switchable look-up pitch thresholds (degrees). */
export const LOOK_UP_THRESHOLDS_DEG = [20, 30] as const
export type LookUpThresholdDeg = (typeof LOOK_UP_THRESHOLDS_DEG)[number]
export const DEFAULT_LOOK_UP_THRESHOLD_DEG: LookUpThresholdDeg = 20

/** Exit lookUp when pitch drops below threshold − hysteresis. */
export const LOOK_UP_HYSTERESIS_DEG = 5

export type GravitySample = { x: number; y: number; z: number }

/**
 * Pitch from gravity-normalized accel.
 * Rest looking ahead ≈ +z; look up (head back) → +x (tilt-B axis in head-tilt).
 * Degrees: positive = look up, negative = look down.
 */
export function pitchDegreesFromGravity(g: GravitySample): number {
  return (Math.atan2(g.x, g.z) * 180) / Math.PI
}

/**
 * Roll from gravity-normalized accel (ear ↔ shoulder).
 * Rest ≈ +z; tilt-R → +y, tilt-L → −y (same axes as head-tilt-control).
 * Degrees: positive = tilt-R, negative = tilt-L.
 */
export function rollDegreesFromGravity(g: GravitySample): number {
  return (Math.atan2(g.y, g.z) * 180) / Math.PI
}

export function resolveLookUpPose(args: {
  pitchDeg: number
  thresholdDeg: LookUpThresholdDeg
  previous: Pose
  hysteresisDeg?: number
}): Pose {
  const { pitchDeg, thresholdDeg, previous } = args
  const hysteresis = args.hysteresisDeg ?? LOOK_UP_HYSTERESIS_DEG
  const exitDeg = thresholdDeg - hysteresis

  if (previous === 'lookUp') {
    return pitchDeg < exitDeg ? 'neutral' : 'lookUp'
  }
  return pitchDeg >= thresholdDeg ? 'lookUp' : 'neutral'
}

export function isLookUpThresholdDeg(value: unknown): value is LookUpThresholdDeg {
  return value === 20 || value === 30
}

/**
 * Once Hub IMU samples are flowing, temple click must not toggle pose.
 * Otherwise: lookUp → tap forces neutral (blank) → next IMU restores lookUp (flicker).
 */
export function shouldIgnoreTemplePoseToggle(args: {
  imuSampleSeen: boolean
  poseSource: 'imu' | 'manual' | 'none'
}): boolean {
  void args.poseSource
  return args.imuSampleSeen
}
