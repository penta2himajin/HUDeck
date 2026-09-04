import { describe, expect, it } from 'vitest'
import { shouldIgnoreTemplePoseToggle } from './look-up-pose.ts'

describe('shouldIgnoreTemplePoseToggle', () => {
  it('ignores temple pose toggle once IMU is driving pitch', () => {
    expect(
      shouldIgnoreTemplePoseToggle({
        imuSampleSeen: true,
        poseSource: 'imu',
      }),
    ).toBe(true)
  })

  it('allows temple pose toggle before any IMU sample (simulator)', () => {
    expect(
      shouldIgnoreTemplePoseToggle({
        imuSampleSeen: false,
        poseSource: 'none',
      }),
    ).toBe(false)
  })

  it('still ignores after manual override if IMU samples continue', () => {
    // Avoid flicker: tap→neutral then IMU immediately restores lookUp.
    expect(
      shouldIgnoreTemplePoseToggle({
        imuSampleSeen: true,
        poseSource: 'manual',
      }),
    ).toBe(true)
  })
})
