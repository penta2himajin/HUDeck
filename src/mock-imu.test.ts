import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { gravityAtPitchDeg, startMockImu } from './mock-imu.ts'
import { pitchDegreesFromGravity } from './look-up-pose.ts'

describe('startMockImu', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // minimal window for inject binding
    ;(globalThis as unknown as { window: Window }).window = globalThis as unknown as Window
  })

  afterEach(() => {
    vi.useRealTimers()
    delete (globalThis as unknown as { window?: Window }).window
  })

  it('re-emits the last injected gravity instead of snapping back to rest', () => {
    const samples: { x: number; y: number; z: number }[] = []
    const handle = startMockImu((s) => samples.push({ x: s.x, y: s.y, z: s.z }))
    const up = gravityAtPitchDeg(25)
    handle.inject(up.x, up.y, up.z)
    samples.length = 0
    vi.advanceTimersByTime(600)
    expect(samples.length).toBeGreaterThanOrEqual(2)
    for (const s of samples) {
      expect(pitchDegreesFromGravity(s)).toBeGreaterThan(20)
    }
    handle.stop()
  })
})
