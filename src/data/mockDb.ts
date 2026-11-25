import { ME } from '@/config'
import { rankPlayers, type ChangeEvent, type Player, type RankedEntry } from '@/domain/ranking'

export type MonthStatus = 'closed' | 'live' | 'upcoming'

export interface MonthMeta {
  id: string
  label: string
  status: MonthStatus
}

interface MonthState {
  meta: MonthMeta
  players: Map<string, Player>
  revision: number
  snapshots: Map<number, readonly RankedEntry[]>
}

export type SnapshotResult =
  | { ok: true; revision: number; entries: readonly RankedEntry[] }
  | { ok: false; reason: 'not_found' | 'expired' }

const SNAPSHOT_LIMIT = 60


function createRandom(seed: number) {
  let s = seed >>> 0
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const pick = <T,>(list: readonly T[]) => list[Math.floor(next() * list.length)]
  return { next, pick }
}

const FAMILY = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý']
const MIDDLE = ['Văn', 'Thị', 'Minh', 'Thanh', 'Quốc', 'Ngọc', 'Gia', 'Hoài', 'Đức', 'Bảo', 'Khánh', 'Thu']
const GIVEN = ['An', 'Bình', 'Châu', 'Duy', 'Hà', 'Hải', 'Hiếu', 'Khang', 'Khoa', 'Linh', 'Long', 'Mai', 'My', 'Nam', 'Ngân', 'Nhi', 'Phúc', 'Quân', 'Quyên', 'Sơn', 'Tâm', 'Thảo', 'Trang', 'Trí', 'Tú', 'Uyên', 'Vy', 'Yến']
const LONG_NAME = 'Tôn Nữ Hoàng Thị Phương Thảo Nguyên'
const SCORE_STEPS = [0, 0, 0, 5, 10, 10, 15, 20]
const DAY = 86_400_000
const avatarUrl = (id: string) => `https://i.pravatar.cc/96?u=${encodeURIComponent(id)}`

interface Seed {
  id: string
  label: string
  status: MonthStatus
  count: number
  top: number
  meAt: number | null
  tieAt?: number
}

const SEEDS: Seed[] = [
  { id: '2024-08', label: 'Tháng 8/2024', status: 'closed', count: 112, top: 1280, meAt: 41 },
  { id: '2024-09', label: 'Tháng 9/2024', status: 'closed', count: 104, top: 999, meAt: 99, tieAt: 8 },
  { id: '2024-10', label: 'Tháng 10/2024', status: 'closed', count: 118, top: 1120, meAt: null },
  { id: '2024-11', label: 'Tháng 11/2024', status: 'live', count: 103, top: 1200, meAt: 17, tieAt: 1 },
  { id: '2024-12', label: 'Tháng 12/2024', status: 'upcoming', count: 0, top: 0, meAt: null },
]

function seedPlayers(seed: Seed, index: number): Player[] {
  const random = createRandom(2024 + index * 97)
  const [year, month] = seed.id.split('-').map(Number)
  const monthStart = Date.UTC(year, month - 1, 1)
  const players: Player[] = []
  let score = seed.top

  for (let i = 0; i < seed.count; i++) {
    if (i > 0) score = Math.max(10, score - random.pick(SCORE_STEPS))
    const isMe = i === seed.meAt
    const id = isMe ? ME.id : `${seed.id}-${String(i).padStart(3, '0')}`
    players.push({
      id,
      avatarUrl: avatarUrl(id),
      name: isMe ? ME.name : i === 6 ? LONG_NAME : `${random.pick(FAMILY)} ${random.pick(MIDDLE)} ${random.pick(GIVEN)}`,
      score,
      reachedAt: monthStart + Math.floor(random.next() * 27 * DAY),
    })
  }

  if (seed.tieAt !== undefined) {
    const tieScore = players[seed.tieAt].score
    players[seed.tieAt + 1].score = tieScore
    players[seed.tieAt + 2].score = tieScore
  }
  return players
}

const months = new Map<string, MonthState>()
SEEDS.forEach((seed, index) => {
  const players = new Map(seedPlayers(seed, index).map((p) => [p.id, p]))
  months.set(seed.id, {
    meta: { id: seed.id, label: seed.label, status: seed.status },
    players,
    revision: 1,
    snapshots: new Map([[1, rankPlayers(players.values())]]),
  })
})


const listeners = new Set<(event: ChangeEvent) => void>()
let joinCounter = 0

const positionIn = (entries: readonly RankedEntry[] | undefined, id: string) => {
  const index = entries?.findIndex((e) => e.id === id) ?? -1
  return index >= 0 ? index + 1 : null
}

function commit(state: MonthState, kind: ChangeEvent['kind'], playerId: string) {
  const fromPosition = positionIn(state.snapshots.get(state.revision), playerId)
  const entries = rankPlayers(state.players.values())
  state.revision += 1
  state.snapshots.set(state.revision, entries)
  if (state.snapshots.size > SNAPSHOT_LIMIT) {
    const oldest = state.snapshots.keys().next().value
    if (oldest !== undefined) state.snapshots.delete(oldest)
  }
  const event: ChangeEvent = {
    monthId: state.meta.id,
    revision: state.revision,
    kind,
    playerId,
    fromPosition,
    toPosition: positionIn(entries, playerId),
    total: entries.length,
  }
  listeners.forEach((fn) => fn(event))
}

function requireMonth(monthId: string) {
  const state = months.get(monthId)
  if (!state) throw new Error(`Không có tháng ${monthId}`)
  return state
}

export const mockDb = {
  listMonths: (): MonthMeta[] => Array.from(months.values(), (m) => m.meta),

  liveMonthId: () => Array.from(months.values()).find((m) => m.meta.status === 'live')?.meta.id ?? SEEDS[0].id,

  latestRevisions: (): Record<string, number> =>
    Object.fromEntries(Array.from(months.values(), (m) => [m.meta.id, m.revision])),

  /** revision = null là lấy bản mới nhất. Revision đã bị dọn thì trả 'expired'. */
  readSnapshot(monthId: string, revision: number | null): SnapshotResult {
    const state = months.get(monthId)
    if (!state) return { ok: false, reason: 'not_found' }
    const rev = revision ?? state.revision
    const entries = state.snapshots.get(rev)
    return entries ? { ok: true, revision: rev, entries } : { ok: false, reason: 'expired' }
  },

  randomPlayerId(monthId: string): string | null {
    const ids = Array.from(requireMonth(monthId).players.keys()).filter((id) => id !== ME.id)
    return ids.length ? ids[Math.floor(Math.random() * ids.length)] : null
  },

  addScore(monthId: string, playerId: string, delta: number) {
    const state = requireMonth(monthId)
    const player = state.players.get(playerId)
    if (!player || delta === 0) return
    state.players.set(playerId, { ...player, score: Math.max(0, player.score + delta), reachedAt: Date.now() })
    commit(state, 'score', playerId)
  },

  addPlayer(monthId: string) {
    const state = requireMonth(monthId)
    const random = createRandom(Date.now())
    const id = `${monthId}-new-${++joinCounter}`
    state.players.set(id, {
      id,
      avatarUrl: avatarUrl(id),
      name: `${random.pick(FAMILY)} ${random.pick(MIDDLE)} ${random.pick(GIVEN)}`,
      score: 10 * (1 + Math.floor(Math.random() * 15)),
      reachedAt: Date.now(),
    })
    commit(state, 'join', id)
  },

  tieAt(monthId: string, position: number) {
    const state = requireMonth(monthId)
    const ranked = state.snapshots.get(state.revision) ?? []
    const target = ranked[position - 1]
    const challenger = ranked.slice(position).find((e) => e.score < (target?.score ?? 0) && e.id !== ME.id)
    if (!target || !challenger) return
    this.addScore(monthId, challenger.id, target.score - challenger.score)
  },

  subscribe(fn: (event: ChangeEvent) => void) {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
}
