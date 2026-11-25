'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { describeError, isAborted, isSnapshotExpired } from '@/data/errors'
import { fetchLeaderboardPage, fetchMyStanding, type LeaderboardPage, type MyStanding } from '@/data/leaderboardApi'
import { ME } from '@/config'
import { diffEntries, reachesPosition, sameRows, type ChangeEvent, type RowChange } from '@/domain/ranking'
import { LatestOnly } from '@/lib/latestOnly'
import { socket } from '@/realtime/mockSocket'

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error'

export interface Resource<T> {
  status: LoadStatus
  data: T | null
  error: string | null
}

const initial = <T,>(status: LoadStatus): Resource<T> => ({ status, data: null, error: null })

/** Gom thay đổi realtime: tối đa một lần cập nhật mỗi khoảng này. */
const LIVE_INTERVAL_MS = 1000
const CACHE_LIMIT = 80
const pageCache = new Map<string, LeaderboardPage>()
const cacheKey = (monthId: string, revision: number, page: number) => `${monthId}@${revision}#${page}`

function remember(page: LeaderboardPage) {
  pageCache.set(cacheKey(page.monthId, page.revision, page.page), page)
  if (pageCache.size > CACHE_LIMIT) pageCache.delete(pageCache.keys().next().value!)
}

function prefetch(current: LeaderboardPage) {
  const next = current.page + 1
  if (next > current.totalPages || pageCache.has(cacheKey(current.monthId, current.revision, next))) return
  fetchLeaderboardPage({ monthId: current.monthId, page: next, revision: current.revision }).then(remember, () => {})
}

// Component dùng hook này được gắn key theo tháng, nên đổi tháng là mount lại từ đầu, không mang state tháng cũ.
export function useLeaderboard(monthId: string) {
  const [page, setPage] = useState(1)
  const [list, setList] = useState<Resource<LeaderboardPage>>(() => initial('loading'))
  const [me, setMe] = useState<Resource<MyStanding>>(() => initial('idle'))
  const [changes, setChanges] = useState<Record<string, RowChange>>({})
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [holding, setHolding] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  // Revision đang hiển thị: mọi trang và hạng cá nhân đều đọc từ cùng một snapshot.
  const revisionRef = useRef<number | null>(null)
  const pageRef = useRef(1)
  const listRef = useRef(list)
  const meRef = useRef(me)

  const listRequest = useRef(new LatestOnly())
  const meRequest = useRef(new LatestOnly())
  const liveRequest = useRef(new LatestOnly())

  const pendingRef = useRef(false)
  const latestKnownRef = useRef(0)
  const liveInFlightRef = useRef(false)
  const pausedRef = useRef(false)
  const lastLiveRef = useRef(0)
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadMe = useCallback(
    async (revision: number) => {
      const req = meRequest.current.start()
      setMe((s) => ({ ...s, status: 'loading', error: null }))
      try {
        const data = await fetchMyStanding({ monthId, revision, signal: req.signal })
        if (req.isCurrent()) setMe({ status: 'success', data, error: null })
      } catch (err) {
        if (!req.isCurrent() || isAborted(err)) return
        if (isSnapshotExpired(err)) {
          setNotice('Số liệu đã thay đổi nhiều trong lúc bạn xem, bảng đã được tải lại.')
          return loadPageRef.current(pageRef.current, true)
        }
        setMe((s) => ({ ...s, status: 'error', error: describeError(err) }))
      }
    },
    [monthId],
  )

  const applyLiveRef = useRef<() => void>(() => {})
  const loadPageRef = useRef<(target: number, latest?: boolean) => void>(() => {})

  const scheduleLive = useCallback(() => {
    if (!pendingRef.current || pausedRef.current || liveTimer.current || liveInFlightRef.current) return
    const wait = Math.max(0, lastLiveRef.current + LIVE_INTERVAL_MS - Date.now())
    liveTimer.current = setTimeout(() => {
      liveTimer.current = null
      applyLiveRef.current()
    }, wait)
  }, [])

  // Lấy trang và hạng của tôi ở revision mới nhất trong một request, rồi thay cả hai cùng lúc.
  // Đang có một lượt chạy thì không gọi thêm: lượt đó về xong sẽ tự xếp lượt kế nếu còn thay đổi.
  const applyLive = useCallback(async () => {
    if (pausedRef.current || liveInFlightRef.current || listRef.current.status === 'loading') return
    pendingRef.current = false
    lastLiveRef.current = Date.now()
    liveInFlightRef.current = true
    const req = liveRequest.current.start()

    try {
      const next = await fetchLeaderboardPage({
        monthId,
        page: pageRef.current,
        revision: null,
        since: revisionRef.current ?? undefined,
        withMe: true,
        signal: req.signal,
      })
      if (!req.isCurrent() || !next.me) return
      const mine = next.me

      const previous = listRef.current.data
      revisionRef.current = next.revision
      pageRef.current = next.page
      remember(next)
      meRequest.current.cancel()
      setMe({ status: 'success', data: mine, error: null })
      setUpdatedAt(Date.now())
      setNotice(null)

      // Trang không đổi gì: giữ nguyên danh sách, chỉ cập nhật số liệu tổng.
      if (previous && previous.page === next.page && sameRows(previous.items, next.items)) {
        if (previous.total !== next.total || previous.totalPages !== next.totalPages) {
          setList({ status: 'success', data: { ...next, items: previous.items }, error: null })
        } else {
          setList({ status: 'success', data: { ...previous, revision: next.revision }, error: null })
        }
        return
      }

      setChanges(previous && previous.page === next.page ? diffEntries(previous.items, next.items, next.previous) : {})
      setPage(next.page)
      setList({ status: 'success', data: next, error: null })
    } catch (err) {
      if (!req.isCurrent() || isAborted(err)) return
      // Cập nhật ngầm thất bại thì giữ nguyên bảng đang xem, thử lại ở lượt sau.
      pendingRef.current = true
    } finally {
      // Lượt đã bị chuyển trang huỷ thì không đụng vào cờ của lượt khác.
      if (req.isCurrent()) {
        liveInFlightRef.current = false
        // Có sự kiện mới hơn bản vừa nhận trong lúc chờ thì xếp lượt kế tiếp.
        if (latestKnownRef.current > (revisionRef.current ?? 0)) pendingRef.current = true
        scheduleLive()
      }
    }
  }, [monthId, scheduleLive])

  const loadPage = useCallback(
    async (target: number, latest = false) => {
      liveRequest.current.cancel()
      liveInFlightRef.current = false
      if (liveTimer.current) {
        clearTimeout(liveTimer.current)
        liveTimer.current = null
      }

      const revision = latest ? null : revisionRef.current
      const req = listRequest.current.start()
      pageRef.current = target
      setPage(target)
      setChanges({})

      const cached = revision !== null ? pageCache.get(cacheKey(monthId, revision, target)) : undefined
      if (cached) {
        setList({ status: 'success', data: cached, error: null })
        scheduleLive()
        return
      }

      setList((s) => ({ ...s, status: 'loading', error: null }))
      try {
        // Lấy bản mới nhất thì xin kèm luôn hạng của tôi, khỏi phải chờ thêm một lượt.
        const data = await fetchLeaderboardPage({
          monthId,
          page: target,
          revision,
          withMe: revision === null,
          signal: req.signal,
        })
        if (!req.isCurrent()) return

        const revisionChanged = data.revision !== revisionRef.current
        revisionRef.current = data.revision
        pageRef.current = data.page // server kéo về trang cuối nếu số trang giảm
        remember(data)

        setPage(data.page)
        setList({ status: 'success', data, error: null })
        if (revisionChanged) {
          setUpdatedAt(Date.now())
          if (data.me) {
            meRequest.current.cancel()
            setMe({ status: 'success', data: data.me, error: null })
          } else loadMe(data.revision)
        }
        prefetch(data)
        scheduleLive()
      } catch (err) {
        if (!req.isCurrent() || isAborted(err)) return
        if (isSnapshotExpired(err)) {
          setNotice('Số liệu đã thay đổi nhiều trong lúc bạn xem, bảng đã được tải lại.')
          return loadPage(target, true)
        }
        setList((s) => ({ ...s, status: 'error', error: describeError(err) }))
      }
    },
    [monthId, loadMe, scheduleLive],
  )

  useLayoutEffect(() => {
    listRef.current = list
    meRef.current = me
    applyLiveRef.current = applyLive
    loadPageRef.current = loadPage
  })

  useEffect(() => {
    const listReq = listRequest.current
    const meReq = meRequest.current
    const liveReq = liveRequest.current
    loadPage(1, true)
    return () => {
      listReq.cancel()
      meReq.cancel()
      liveReq.cancel()
      if (liveTimer.current) clearTimeout(liveTimer.current)
      liveTimer.current = null
    }
  }, [loadPage])

  useEffect(() => {
    const markPending = (revision: number) => {
      const shown = revisionRef.current
      // Sự kiện có thể tới muộn hoặc lệch thứ tự, nên chỉ so theo revision.
      if (shown !== null && revision <= shown) return
      latestKnownRef.current = Math.max(latestKnownRef.current, revision)
      pendingRef.current = true
      if (pausedRef.current) setHolding(true)
      if (shown !== null) scheduleLive()
    }

    // Thay đổi không chạm tới trang đang xem lẫn vị trí của tôi: chỉ ghi nhận revision mới + tổng số người,
    // không gọi API, không render lại dòng nào. Chỉ làm được khi revision liền kề (không lỡ sự kiện nào).
    const skipIfUntouched = (event: ChangeEvent) => {
      const { status, data } = listRef.current
      const shown = revisionRef.current
      if (
        status !== 'success' ||
        !data ||
        pendingRef.current ||
        liveInFlightRef.current ||
        shown === null ||
        event.revision !== shown + 1
      )
        return false

      const lastOnPage = data.page * data.pageSize
      const mine = meRef.current.data
      const meTouched = mine?.entry ? reachesPosition(event, mine.entry.position) : event.playerId === ME.id
      if (reachesPosition(event, lastOnPage) || meTouched || !mine) return false

      revisionRef.current = event.revision
      const totalPages = Math.max(1, Math.ceil(event.total / data.pageSize))
      const next = { ...data, revision: event.revision, total: event.total, totalPages }
      remember(next)
      setList({ status: 'success', data: next, error: null })
      setMe({ status: 'success', data: { ...mine, revision: event.revision, total: event.total }, error: null })
      setUpdatedAt(Date.now())
      return true
    }

    const offChanged = socket.on('leaderboard:changed', (event) => {
      if (event.monthId !== monthId) return
      if (!skipIfUntouched(event)) markPending(event.revision)
    })
    const offSync = socket.on('sync', (revisions) => {
      if (revisions[monthId] !== undefined) markPending(revisions[monthId])
    })
    return () => {
      offChanged()
      offSync()
    }
  }, [monthId, scheduleLive])

  // Người dùng đang rê chuột / focus trong bảng thì giữ nguyên, rời ra mới áp dụng phần đã dồn.
  const setPaused = useCallback(
    (paused: boolean) => {
      if (pausedRef.current === paused) return
      pausedRef.current = paused
      if (paused) {
        if (liveTimer.current) clearTimeout(liveTimer.current)
        liveTimer.current = null
        setHolding(pendingRef.current)
      } else {
        setHolding(false)
        scheduleLive()
      }
    },
    [scheduleLive],
  )

  const goToPage = useCallback(
    (target: number) => {
      if (target === pageRef.current && listRef.current.status === 'success') return
      loadPage(target)
    },
    [loadPage],
  )

  const retryList = useCallback(() => loadPage(pageRef.current, revisionRef.current === null), [loadPage])

  const retryMe = useCallback(() => {
    if (revisionRef.current !== null) loadMe(revisionRef.current)
  }, [loadMe])

  return {
    page,
    list,
    me,
    changes,
    updatedAt,
    holding,
    notice,
    goToPage,
    retryList,
    retryMe,
    setPaused,
  }
}
