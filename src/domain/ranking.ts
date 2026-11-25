
export interface Player {
  id: string
  name: string
  avatarUrl?: string
  score: number
  reachedAt: number
}

export interface RankedEntry extends Player {
  rank: number
  position: number
  tied: boolean
}

/**
 * Thứ tự tổng: điểm giảm dần, rồi ai đạt mức điểm đó trước, cuối cùng là id.
 * Có thứ tự tổng thì cắt trang ở đâu cũng không lặp hay sót người.
 */
export function compareStanding(a: Player, b: Player): number {
  if (a.score !== b.score) return b.score - a.score
  if (a.reachedAt !== b.reachedAt) return a.reachedAt - b.reachedAt
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function rankPlayers(players: Iterable<Player>): RankedEntry[] {
  const sorted = Array.from(players).sort(compareStanding)
  const ranked: RankedEntry[] = []

  for (let i = 0; i < sorted.length; i++) {
    const player = sorted[i]
    const prev = ranked[i - 1]
    const sameAsPrev = prev !== undefined && prev.score === player.score
    const sameAsNext = sorted[i + 1]?.score === player.score

    ranked.push({
      ...player,
      // Hạng liên tục: bằng điểm thì cùng hạng, người kế tiếp lấy hạng ngay sau (1, 2, 2, 3).
      rank: prev === undefined ? 1 : sameAsPrev ? prev.rank : prev.rank + 1,
      position: i + 1,
      tied: sameAsPrev || sameAsNext,
    })
  }
  return ranked
}

export const isPodium = (rank: number) => rank <= 3

export interface Page<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page)) return 1
  return Math.min(Math.max(1, Math.trunc(page)), Math.max(1, totalPages))
}

export function paginate<T>(list: readonly T[], page: number, pageSize: number): Page<T> {
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize))
  const safePage = clampPage(page, totalPages)
  const start = (safePage - 1) * pageSize
  return {
    items: list.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    total: list.length,
    totalPages,
  }
}

export const pageOfPosition = (position: number, pageSize: number) => Math.ceil(position / pageSize)

export type PageSlot = number | 'gap'

const SLOTS = 7

/**
 * Luôn trả đúng min(total, 7) ô để thanh phân trang không đổi bề rộng khi chuyển trang:
 * Ví dụ với 10 trang: [1 2 3 4 5 … 10], [1 … 4 5 6 … 10], [1 … 6 7 8 9 10].
 */
export function pageWindow(current: number, total: number): PageSlot[] {
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
  if (total <= SLOTS) return range(1, total)
  if (current <= 4) return [...range(1, 5), 'gap', total]
  if (current >= total - 3) return [1, 'gap', ...range(total - 4, total)]
  return [1, 'gap', current - 1, current, current + 1, 'gap', total]
}

export interface RowChange {
  /** Dương = tăng hạng. */
  move: number
  scoreDelta: number
  entered: boolean
}

export type Standing = Pick<RankedEntry, 'rank' | 'score'>

/** Hai lần xem của cùng một trang có giống hệt nhau về người, hạng, điểm không. */
export function sameRows(a: readonly RankedEntry[], b: readonly RankedEntry[]) {
  return (
    a.length === b.length &&
    a.every((e, i) => e.id === b[i].id && e.rank === b[i].rank && e.score === b[i].score && e.tied === b[i].tied)
  )
}

/**
 * `before`: các dòng trang đang hiển thị (để biết ai mới vào trang).
 * `previous`: hạng/điểm cũ do server trả theo revision cũ, có cả người đến từ trang khác.
 */
export function diffEntries(
  before: readonly RankedEntry[],
  after: readonly RankedEntry[],
  previous: Record<string, Standing> = {},
) {
  const onPage = new Map(before.map((e) => [e.id, e]))
  const changes: Record<string, RowChange> = {}
  for (const entry of after) {
    const old = previous[entry.id] ?? onPage.get(entry.id)
    const entered = !onPage.has(entry.id)
    const move = old ? old.rank - entry.rank : 0
    const scoreDelta = old ? entry.score - old.score : 0
    if (entered || move || scoreDelta) changes[entry.id] = { move, scoreDelta, entered }
  }
  return changes
}

export interface ChangeEvent {
  monthId: string
  revision: number
  kind: 'score' | 'join'
  playerId: string | null
  /** Vị trí trước/sau thay đổi (1-based); người mới tham gia thì fromPosition = null. */
  fromPosition: number | null
  toPosition: number | null
  total: number
}

/**
 * Thay đổi có lan tới dòng ở vị trí `position` (hoặc phía trên nó) không.
 * Hạng liên tục phụ thuộc số mức điểm khác nhau phía trên, nên một thay đổi ở vị trí p,
 * kể cả chỉ tạo hay tách đồng hạng mà không đổi chỗ, có thể làm lệch hạng mọi dòng từ p trở xuống.
 * Dòng ngay trên p cũng tính vì trạng thái đồng hạng của nó có thể đổi.
 * Kiểm tra một trang thì truyền vị trí dòng cuối của trang.
 */
export function reachesPosition(event: ChangeEvent, position: number) {
  const from = event.fromPosition ?? Infinity
  const to = event.toPosition ?? Infinity
  return Math.min(from, to) - 1 <= position
}
