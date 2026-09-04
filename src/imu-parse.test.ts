import { describe, expect, it } from 'vitest'
import { parseAccelSample } from './imu-parse.ts'

describe('parseAccelSample', () => {
  it('reads Hub-style xyz', () => {
    expect(parseAccelSample({ x: 0.1, y: -0.2, z: 0.98 }, 42)).toEqual({
      x: 0.1,
      y: -0.2,
      z: 0.98,
      t: 42,
    })
  })
})
