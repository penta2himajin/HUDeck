/** Parse Hub imuData / mock payloads into gravity xyz. */

export type AccelSample = { x: number; y: number; z: number; t: number }

function asNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function pickTriple(
  raw: Record<string, unknown>,
  keys: [string, string, string],
): [number, number, number] | null {
  const a = asNum(raw[keys[0]])
  const b = asNum(raw[keys[1]])
  const c = asNum(raw[keys[2]])
  if (a === null || b === null || c === null) return null
  return [a, b, c]
}

export function parseAccelSample(rawIn: unknown, t = Date.now()): AccelSample {
  const raw =
    rawIn && typeof rawIn === 'object' ? (rawIn as Record<string, unknown>) : {}
  const triple =
    pickTriple(raw, ['x', 'y', 'z']) ??
    pickTriple(raw, ['ax', 'ay', 'az']) ??
    pickTriple(raw, ['accX', 'accY', 'accZ']) ??
    ([0, 0, 0] as [number, number, number])
  return { x: triple[0], y: triple[1], z: triple[2], t }
}
