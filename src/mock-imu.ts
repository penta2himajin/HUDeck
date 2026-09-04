import type { AccelSample } from './imu-parse.ts'

export type ImuListener = (sample: AccelSample) => void

export interface MockImuHandle {
  stop(): void
  inject(x: number, y: number, z: number): void
}

declare global {
  interface Window {
    __hudeckInjectImu?: (x: number, y: number, z: number) => void
  }
}

/** Deskless helper: synthetic IMU when hardware/simulator provides none. */
export function startMockImu(onSample: ImuListener): MockImuHandle {
  const inject = (x: number, y: number, z: number) => {
    onSample({ x, y, z, t: Date.now() })
  }
  window.__hudeckInjectImu = inject
  // Keep a quiet rest stream so pitch stays ~0 until inject.
  const id = window.setInterval(() => inject(0, 0, 1), 200)
  return {
    stop: () => {
      window.clearInterval(id)
      delete window.__hudeckInjectImu
    },
    inject,
  }
}

export function mockImuEnabled(): boolean {
  return new URLSearchParams(location.search).get('mockImu') === '1'
}

/** Gravity sample at look-up pitchDeg (degrees, +x). */
export function gravityAtPitchDeg(pitchDeg: number): { x: number; y: number; z: number } {
  const r = (pitchDeg * Math.PI) / 180
  return { x: Math.sin(r), y: 0, z: Math.cos(r) }
}
