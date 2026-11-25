import { ME } from '@/config'
import { mockDb } from './mockDb'

const DELTAS = [10, 10, 20, 30, 50, 80, 120, -20]
const INTERVAL_MS = 2800

let timer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((fn) => fn())
const randomDelta = () => DELTAS[Math.floor(Math.random() * DELTAS.length)]

function tick() {
  const monthId = mockDb.liveMonthId()
  const roll = Math.random()
  if (roll < 0.2) return mockDb.addPlayer(monthId)
  if (roll < 0.3) return mockDb.addScore(monthId, ME.id, randomDelta())
  const playerId = mockDb.randomPlayerId(monthId)
  if (playerId) mockDb.addScore(monthId, playerId, randomDelta())
}

export const simulator = {
  isRunning: () => timer !== null,
  start() {
    if (timer) return
    timer = setInterval(tick, INTERVAL_MS)
    notify()
  },
  stop() {
    if (!timer) return
    clearInterval(timer)
    timer = null
    notify()
  },
  tick,
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
}
