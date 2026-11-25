import { ME, PAGE_SIZE } from '@/config'
import { paginate, type Page, type RankedEntry, type Standing } from '@/domain/ranking'
import { ApiError } from './errors'
import { mockDb, type MonthMeta, type MonthStatus } from './mockDb'
import { simulateRoundTrip } from './network'

export type { MonthMeta, MonthStatus }

export interface LeaderboardPage extends Page<RankedEntry> {
  monthId: string
  revision: number
  /** Chỉ có khi gửi `since`: hạng/điểm của từng người trên trang tại revision cũ đó. */
  previous?: Record<string, Standing>
  /** Chỉ có khi gửi `withMe`: hạng của tôi đọc từ cùng snapshot với trang nên luôn khớp nhau. */
  me?: MyStanding
}

export interface MyStanding {
  monthId: string
  revision: number
  total: number
  entry: RankedEntry | null
}

function readSnapshot(monthId: string, revision: number | null) {
  const result = mockDb.readSnapshot(monthId, revision)
  if (result.ok) return result
  throw new ApiError(result.reason === 'expired' ? 'SNAPSHOT_EXPIRED' : 'NOT_FOUND')
}

function previousStandings(monthId: string, since: number, items: RankedEntry[]) {
  const old = mockDb.readSnapshot(monthId, since)
  if (!old.ok) return undefined
  const ids = new Set(items.map((e) => e.id))
  const result: Record<string, Standing> = {}
  for (const e of old.entries) if (ids.has(e.id)) result[e.id] = { rank: e.rank, score: e.score }
  return result
}

export async function fetchMonths(signal?: AbortSignal): Promise<MonthMeta[]> {
  await simulateRoundTrip(signal)
  return mockDb.listMonths()
}

export async function fetchLeaderboardPage(query: {
  monthId: string
  page: number
  revision: number | null
  since?: number
  withMe?: boolean
  signal?: AbortSignal
}): Promise<LeaderboardPage> {
  await simulateRoundTrip(query.signal)
  // Đọc dữ liệu sau khi chờ, giống server thật trả về trạng thái tại lúc xử lý.
  const snapshot = readSnapshot(query.monthId, query.revision)
  const page = paginate(snapshot.entries, query.page, PAGE_SIZE)
  return {
    monthId: query.monthId,
    revision: snapshot.revision,
    ...page,
    previous: query.since === undefined ? undefined : previousStandings(query.monthId, query.since, page.items),
    me: query.withMe ? standingOf(query.monthId, snapshot) : undefined,
  }
}

function standingOf(monthId: string, snapshot: { revision: number; entries: readonly RankedEntry[] }): MyStanding {
  return {
    monthId,
    revision: snapshot.revision,
    total: snapshot.entries.length,
    entry: snapshot.entries.find((e) => e.id === ME.id) ?? null,
  }
}

export async function fetchMyStanding(query: {
  monthId: string
  revision: number
  signal?: AbortSignal
}): Promise<MyStanding> {
  await simulateRoundTrip(query.signal)
  return standingOf(query.monthId, readSnapshot(query.monthId, query.revision))
}
