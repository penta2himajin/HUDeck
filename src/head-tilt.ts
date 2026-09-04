/**
 * Head-tilt controls aligned with even-head-tilt-control.
 * Fixed bindings (not user-editable yet):
 *   tap ← nod (near-neutral roll + pitch dip ≥ −5° → return)
 *   dbl ← tilt-B hold
 *   swipe-up ← tilt-L hold
 *   swipe-down ← tilt-R hold
 *
 * HUDeck difference: the gesture baseline is the lookUp gravity sample,
 * not flat-desk neutral — all four controls only arm while pose === lookUp.
 */

import { pitchDegreesFromGravity, rollDegreesFromGravity } from './look-up-pose.ts'

export const CONTROL_IDS = ['tap', 'dbl', 'swipe-up', 'swipe-down'] as const
export type ControlId = (typeof CONTROL_IDS)[number]

export const TILT_GESTURES = ['tilt-F', 'tilt-B', 'tilt-L', 'tilt-R'] as const
export type TiltGesture = (typeof TILT_GESTURES)[number]

/** Hold gestures that fire on dwell (tap/nod is oscillate-only). */
export const HOLD_CONTROL_GESTURES = ['tilt-B', 'tilt-L', 'tilt-R'] as const
export type HoldControlGesture = (typeof HOLD_CONTROL_GESTURES)[number]

/** Fixed map: nod→tap; holds→dbl / swipe-*. */
export const FIXED_GESTURE_TO_CONTROL: Record<
  'nod' | HoldControlGesture,
  ControlId
> = {
  nod: 'tap',
  'tilt-B': 'dbl',
  'tilt-L': 'swipe-up',
  'tilt-R': 'swipe-down',
}

export const FIXED_CONTROL_TO_GESTURE: Record<ControlId, string> = {
  tap: 'nod',
  dbl: 'tilt-B',
  'swipe-up': 'tilt-L',
  'swipe-down': 'tilt-R',
}

/** @deprecated Prefer FIXED_CONTROL_TO_GESTURE (tap is nod, not tilt-F hold). */
export const FIXED_CONTROL_TO_TILT = FIXED_CONTROL_TO_GESTURE

/** |offset| below this ⇒ still on the lookUp baseline (accel). */
export const LOOKUP_NEUTRAL_BAND = 0.12
/** |offset| above this ⇒ candidate hold pose vs lookUp baseline. */
export const LOOKUP_HOLD_ENTER = 0.2
/** Dwell in a reach zone before emitting a hold control. */
export const LOOKUP_REACH_MS = 100
/** Ignore further fires briefly after a control. */
export const LOOKUP_EXEC_COOLDOWN_MS = 150
/**
 * After a tilt-L/R fire, easing |offset.y| back from its peak by this amount
 * rearms the gesture without requiring full neutral (neck-friendly pulse).
 * tilt-B (dbl) still clears only via neutral band.
 */
export const LOOKUP_ROLL_REARM_DROP = 0.08
/** After rearm, |offset.y| must rise this much from the trough before a new dwell. */
export const LOOKUP_ROLL_REARM_RISE = 0.04

/**
 * Nod / tap: pitch must drop at least this many degrees below the lookUp
 * baseline, then return, to count as one acquisition.
 */
export const NOD_DIP_DEG = 5
/** |Δpitch| within this of baseline counts as “back at lookUp” for nod return. */
export const NOD_RETURN_DEG = 2
/**
 * Nod only while |Δroll| from lookUp baseline is within this window.
 * Buffer under tilt-L/R enter (~asin(0.20) ≈ 11.5°) so side holds never count as nod.
 */
export const NOD_ROLL_MAX_DEG = 8
/** Cancel an unfinished nod if no return within this window. */
export const NOD_MAX_MS = 1500

export type GravitySample = { x: number; y: number; z: number; t?: number }

export type Vec3 = { x: number; y: number; z: number }

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

export function absMax(v: Vec3): number {
  return Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z))
}

/**
 * Map offset-from-lookUp-baseline to a hold pose (accel axes from head-tilt-control).
 * pitch → x (tilt-F −x / tilt-B +x), roll → y (tilt-L −y / tilt-R +y).
 */
export function holdFromLookUpOffset(
  offset: Vec3,
  enter = LOOKUP_HOLD_ENTER,
): TiltGesture | null {
  const ax = Math.abs(offset.x)
  const ay = Math.abs(offset.y)
  const az = Math.abs(offset.z)
  const peak = Math.max(ax, ay, az)
  if (peak < enter) return null

  if (ay >= ax && ay >= az) {
    return offset.y >= 0 ? 'tilt-R' : 'tilt-L'
  }
  if (ax >= ay && ax >= az) {
    return offset.x < 0 ? 'tilt-F' : 'tilt-B'
  }
  return null
}

export function isHoldControlGesture(
  gesture: TiltGesture,
): gesture is HoldControlGesture {
  return (
    gesture === 'tilt-B' || gesture === 'tilt-L' || gesture === 'tilt-R'
  )
}

export function controlForHold(gesture: HoldControlGesture): ControlId {
  return FIXED_GESTURE_TO_CONTROL[gesture]
}

export function isControlId(value: unknown): value is ControlId {
  return (
    value === 'tap' ||
    value === 'dbl' ||
    value === 'swipe-up' ||
    value === 'swipe-down'
  )
}

export type LookUpTiltStatus = {
  armed: boolean
  held: HoldControlGesture | null
  reaching: HoldControlGesture | null
  nodActive: boolean
  nodPeakDipDeg: number
  rollPeakAbs: number
  rollAwaitRise: boolean
}

/**
 * Session that arms only while lookUp. Baseline snaps on arm().
 * - nod (|Δroll| ≤ NOD_ROLL_MAX_DEG + pitch dip ≥ NOD_DIP_DEG then return) → tap
 * - tilt-B / L / R dwell → dbl / swipe-up / swipe-down
 * - tilt-L/R rearm by easing |y| from peak by LOOKUP_ROLL_REARM_DROP (no full neutral)
 * - tilt-F hold alone does not fire (use nod for tap)
 */
export class LookUpTiltSession {
  private baseline: Vec3 | null = null
  private baselinePitchDeg = 0
  private baselineRollDeg = 0
  private armed = false
  private held: HoldControlGesture | null = null
  private reachGesture: HoldControlGesture | null = null
  private reachSince: number | null = null
  private lastFireAt = Number.NEGATIVE_INFINITY
  /** Peak |offset.y| while held on tilt-L/R (for peak-return rearm). */
  private rollPeakAbs = 0
  /** After peak-return rearm, wait for |y| to rise from trough before dwell. */
  private rollAwaitRise = false
  private rollTroughAbs = 0

  private nodActive = false
  private nodPeakDipDeg = 0
  private nodStartedAt: number | null = null

  arm(sample: GravitySample): void {
    this.armed = true
    this.baseline = { x: sample.x, y: sample.y, z: sample.z }
    this.baselinePitchDeg = pitchDegreesFromGravity(sample)
    this.baselineRollDeg = rollDegreesFromGravity(sample)
    this.held = null
    this.reachGesture = null
    this.reachSince = null
    this.rollPeakAbs = 0
    this.rollAwaitRise = false
    this.rollTroughAbs = 0
    this.clearNod()
  }

  disarm(): void {
    this.armed = false
    this.baseline = null
    this.held = null
    this.reachGesture = null
    this.reachSince = null
    this.rollPeakAbs = 0
    this.rollAwaitRise = false
    this.rollTroughAbs = 0
    this.clearNod()
  }

  isArmed(): boolean {
    return this.armed
  }

  status(): LookUpTiltStatus {
    return {
      armed: this.armed,
      held: this.held,
      reaching: this.reachGesture,
      nodActive: this.nodActive,
      nodPeakDipDeg: this.nodPeakDipDeg,
      rollPeakAbs: this.rollPeakAbs,
      rollAwaitRise: this.rollAwaitRise,
    }
  }

  /** Snapshot for debug-ws (does not mutate). */
  telemetry(sample?: GravitySample): Record<string, unknown> {
    const st = this.status()
    const out: Record<string, unknown> = {
      ...st,
      baselinePitchDeg: this.baseline ? this.baselinePitchDeg : null,
      baselineRollDeg: this.baseline ? this.baselineRollDeg : null,
      holdEnter: LOOKUP_HOLD_ENTER,
      reachMs: LOOKUP_REACH_MS,
      rollRearmDrop: LOOKUP_ROLL_REARM_DROP,
      rollRearmRise: LOOKUP_ROLL_REARM_RISE,
      nodDipDeg: NOD_DIP_DEG,
      nodReturnDeg: NOD_RETURN_DEG,
      nodRollMaxDeg: NOD_ROLL_MAX_DEG,
    }
    if (sample && this.baseline) {
      const g = { x: sample.x, y: sample.y, z: sample.z }
      const offset = sub(g, this.baseline)
      const pitchDeg = pitchDegreesFromGravity(g)
      const rollDeg = rollDegreesFromGravity(g)
      out.sample = g
      out.offset = offset
      out.offsetMag = absMax(offset)
      out.pitchDeg = pitchDeg
      out.rollDeg = rollDeg
      out.deltaPitchDeg = pitchDeg - this.baselinePitchDeg
      out.deltaRollDeg = rollDeg - this.baselineRollDeg
      out.holdZone = holdFromLookUpOffset(offset)
    }
    return out
  }

  private clearNod(): void {
    this.nodActive = false
    this.nodPeakDipDeg = 0
    this.nodStartedAt = null
  }

  private clearRollHold(): void {
    this.held = null
    this.rollPeakAbs = 0
    this.rollAwaitRise = false
    this.rollTroughAbs = 0
    this.reachGesture = null
    this.reachSince = null
  }

  private fire(control: ControlId, now: number): ControlId | null {
    if (now - this.lastFireAt < LOOKUP_EXEC_COOLDOWN_MS) return null
    this.lastFireAt = now
    return control
  }

  private isRollHold(gesture: HoldControlGesture): boolean {
    return gesture === 'tilt-L' || gesture === 'tilt-R'
  }

  /**
   * Feed one gravity sample while lookUp.
   * Returns a ControlId on nod-return or hold-enter; null otherwise.
   */
  push(sample: GravitySample): ControlId | null {
    if (!this.armed || !this.baseline) return null
    const now = sample.t ?? Date.now()
    const g = { x: sample.x, y: sample.y, z: sample.z }
    const offset = sub(g, this.baseline)
    const pitchDeg = pitchDegreesFromGravity(g)
    const rollDeg = rollDegreesFromGravity(g)
    const deltaPitch = pitchDeg - this.baselinePitchDeg
    const deltaRoll = rollDeg - this.baselineRollDeg
    const mag = absMax(offset)
    const rollNearNeutral = Math.abs(deltaRoll) <= NOD_ROLL_MAX_DEG
    const ay = Math.abs(offset.y)

    // --- Nod path (tap): near-neutral roll + pitch dip then return ---
    if (this.nodActive && this.nodStartedAt != null && now - this.nodStartedAt > NOD_MAX_MS) {
      this.clearNod()
    }

    if (!rollNearNeutral) {
      // Side tilt wins — do not steal hold reach with a partial nod.
      if (this.nodActive) this.clearNod()
    } else if (deltaPitch <= -NOD_RETURN_DEG) {
      // Chin-forward relative to lookUp: track nod peak.
      if (!this.nodActive) {
        this.nodActive = true
        this.nodStartedAt = now
        this.nodPeakDipDeg = deltaPitch
      } else if (deltaPitch < this.nodPeakDipDeg) {
        this.nodPeakDipDeg = deltaPitch
      }
      // Cancel hold reach only while a genuine (low-roll) nod is in progress.
      this.reachGesture = null
      this.reachSince = null
    } else if (this.nodActive && Math.abs(deltaPitch) <= NOD_RETURN_DEG) {
      const peaked = this.nodPeakDipDeg <= -NOD_DIP_DEG
      this.clearNod()
      if (peaked) {
        this.clearRollHold()
        return this.fire('tap', now)
      }
    }

    // --- Hold path: tilt-B / L / R only (not tilt-F) ---
    if (mag <= LOOKUP_NEUTRAL_BAND) {
      this.clearRollHold()
      return null
    }

    const gesture = holdFromLookUpOffset(offset)
    if (!gesture || !isHoldControlGesture(gesture)) {
      // tilt-F dwell is ignored for controls (nod handles tap).
      this.reachGesture = null
      this.reachSince = null
      // Leaving a roll hold into tilt-F clears roll peak lock.
      if (this.held === 'tilt-L' || this.held === 'tilt-R') this.clearRollHold()
      return null
    }

    // Peak-return rearm for tilt-L/R: ease back from peak without full neutral.
    if (this.held != null && this.isRollHold(this.held)) {
      if (gesture === this.held) {
        if (ay > this.rollPeakAbs) this.rollPeakAbs = ay
        if (this.rollPeakAbs - ay >= LOOKUP_ROLL_REARM_DROP) {
          this.held = null
          this.rollPeakAbs = 0
          this.reachGesture = null
          this.reachSince = null
          this.rollAwaitRise = true
          this.rollTroughAbs = ay
          return null
        }
        return null
      }
      // Opposite roll or tilt-B — drop previous lock.
      this.held = null
      this.rollPeakAbs = 0
      this.rollAwaitRise = false
      this.rollTroughAbs = 0
    }

    // After rearm, require a rising pulse from the trough before a new dwell.
    if (this.rollAwaitRise && this.isRollHold(gesture)) {
      if (ay < this.rollTroughAbs) this.rollTroughAbs = ay
      if (ay < this.rollTroughAbs + LOOKUP_ROLL_REARM_RISE) {
        this.reachGesture = null
        this.reachSince = null
        return null
      }
      this.rollAwaitRise = false
      this.rollTroughAbs = 0
    }

    if (this.held === gesture) return null

    if (this.reachGesture !== gesture) {
      this.reachGesture = gesture
      this.reachSince = now
      // Side/back hold cancels an unfinished nod.
      this.clearNod()
      return null
    }

    if (this.reachSince == null || now - this.reachSince < LOOKUP_REACH_MS) {
      return null
    }

    this.held = gesture
    this.rollPeakAbs = this.isRollHold(gesture) ? ay : 0
    this.rollAwaitRise = false
    this.rollTroughAbs = 0
    this.reachGesture = null
    this.reachSince = null
    return this.fire(controlForHold(gesture), now)
  }
}
