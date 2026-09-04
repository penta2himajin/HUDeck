/**
 * Head-tilt controls aligned with even-head-tilt-control.
 * Fixed bindings (not user-editable yet):
 *   tap ← tilt-F, dbl ← tilt-B, swipe-up ← tilt-L, swipe-down ← tilt-R
 *
 * HUDeck difference: the gesture baseline is the lookUp gravity sample,
 * not flat-desk neutral — all four controls only arm while pose === lookUp.
 */

export const CONTROL_IDS = ['tap', 'dbl', 'swipe-up', 'swipe-down'] as const
export type ControlId = (typeof CONTROL_IDS)[number]

export const TILT_GESTURES = ['tilt-F', 'tilt-B', 'tilt-L', 'tilt-R'] as const
export type TiltGesture = (typeof TILT_GESTURES)[number]

/** Fixed map matching head-tilt-control’s intended defaults. */
export const FIXED_TILT_TO_CONTROL: Record<TiltGesture, ControlId> = {
  'tilt-F': 'tap',
  'tilt-B': 'dbl',
  'tilt-L': 'swipe-up',
  'tilt-R': 'swipe-down',
}

export const FIXED_CONTROL_TO_TILT: Record<ControlId, TiltGesture> = {
  tap: 'tilt-F',
  dbl: 'tilt-B',
  'swipe-up': 'tilt-L',
  'swipe-down': 'tilt-R',
}

/** |offset| below this ⇒ still on the lookUp baseline. */
export const LOOKUP_NEUTRAL_BAND = 0.12
/** |offset| above this ⇒ candidate hold pose vs lookUp baseline. */
export const LOOKUP_HOLD_ENTER = 0.26
/** Dwell in a reach zone before emitting a control. */
export const LOOKUP_REACH_MS = 200
/** Ignore further enters briefly after a fire. */
export const LOOKUP_EXEC_COOLDOWN_MS = 150

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

export function controlForTilt(gesture: TiltGesture): ControlId {
  return FIXED_TILT_TO_CONTROL[gesture]
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
  held: TiltGesture | null
  reaching: TiltGesture | null
}

/**
 * Session that arms only while lookUp. Baseline snaps to the first sample
 * after arm(); further tilt holds emit ControlId once per enter.
 */
export class LookUpTiltSession {
  private baseline: Vec3 | null = null
  private armed = false
  private held: TiltGesture | null = null
  private reachGesture: TiltGesture | null = null
  private reachSince: number | null = null
  private lastFireAt = 0

  arm(sample: GravitySample): void {
    this.armed = true
    this.baseline = { x: sample.x, y: sample.y, z: sample.z }
    this.held = null
    this.reachGesture = null
    this.reachSince = null
  }

  disarm(): void {
    this.armed = false
    this.baseline = null
    this.held = null
    this.reachGesture = null
    this.reachSince = null
  }

  isArmed(): boolean {
    return this.armed
  }

  status(): LookUpTiltStatus {
    return {
      armed: this.armed,
      held: this.held,
      reaching: this.reachGesture,
    }
  }

  /**
   * Feed one gravity sample while lookUp.
   * Returns a ControlId on hold-enter; null otherwise.
   */
  push(sample: GravitySample): ControlId | null {
    if (!this.armed || !this.baseline) return null
    const now = sample.t ?? Date.now()
    const offset = sub(
      { x: sample.x, y: sample.y, z: sample.z },
      this.baseline,
    )
    const mag = absMax(offset)

    if (mag <= LOOKUP_NEUTRAL_BAND) {
      this.held = null
      this.reachGesture = null
      this.reachSince = null
      return null
    }

    const gesture = holdFromLookUpOffset(offset)
    if (!gesture) {
      this.reachGesture = null
      this.reachSince = null
      return null
    }

    if (this.held === gesture) return null

    if (this.reachGesture !== gesture) {
      this.reachGesture = gesture
      this.reachSince = now
      return null
    }

    if (this.reachSince == null || now - this.reachSince < LOOKUP_REACH_MS) {
      return null
    }

    if (now - this.lastFireAt < LOOKUP_EXEC_COOLDOWN_MS) return null

    this.held = gesture
    this.reachGesture = null
    this.reachSince = null
    this.lastFireAt = now
    return controlForTilt(gesture)
  }
}
