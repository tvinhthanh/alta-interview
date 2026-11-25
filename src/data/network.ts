import { ApiError } from './errors'

export interface NetworkProfile {
  id: 'stable' | 'flaky' | 'bad'
  label: string
  minLatency: number
  maxLatency: number
  failRate: number
  stallRate: number
}

export const NETWORK_PROFILES: NetworkProfile[] = [
  { id: 'stable', label: 'Ổn định', minLatency: 200, maxLatency: 600, failRate: 0, stallRate: 0 },
  { id: 'flaky', label: 'Chập chờn', minLatency: 300, maxLatency: 1400, failRate: 0.15, stallRate: 0.05 },
  { id: 'bad', label: 'Rất tệ', minLatency: 1200, maxLatency: 3500, failRate: 0.35, stallRate: 0.15 },
]

export const REQUEST_TIMEOUT_MS = 6000

let profile = NETWORK_PROFILES[0]
const listeners = new Set<() => void>()

export const network = {
  get: () => profile,
  set(id: NetworkProfile['id']) {
    profile = NETWORK_PROFILES.find((p) => p.id === id) ?? profile
    listeners.forEach((fn) => fn())
  },
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
}

export function simulateRoundTrip(signal?: AbortSignal): Promise<void> {
  const { minLatency, maxLatency, failRate, stallRate } = profile
  const stalled = Math.random() < stallRate
  const failed = !stalled && Math.random() < failRate
  const latency = stalled ? REQUEST_TIMEOUT_MS * 2 : minLatency + Math.random() * (maxLatency - minLatency)

  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new ApiError('ABORTED'))

    const done = setTimeout(() => {
      cleanup()
      failed ? reject(new ApiError('NETWORK')) : resolve()
    }, latency)
    const timeout = setTimeout(() => {
      cleanup()
      reject(new ApiError('TIMEOUT'))
    }, REQUEST_TIMEOUT_MS)
    const onAbort = () => {
      cleanup()
      reject(new ApiError('ABORTED'))
    }

    function cleanup() {
      clearTimeout(done)
      clearTimeout(timeout)
      signal?.removeEventListener('abort', onAbort)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
