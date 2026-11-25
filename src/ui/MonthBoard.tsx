'use client'

import type { MonthMeta, MonthStatus } from '@/data/leaderboardApi'
import { useLeaderboard } from '@/hooks/useLeaderboard'
import { useSocketStatus } from '@/hooks/useRealtime'
import type { SocketStatus } from '@/realtime/mockSocket'
import { MyStandingCard } from './MyStandingCard'
import { Pagination } from './Pagination'
import { formatScore, RankList } from './RankList'
import styles from './screen.module.css'

const timeFormat = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export function MonthBoard({ month }: { month: MonthMeta }) {
  const board = useLeaderboard(month.id)
  const socketStatus = useSocketStatus()
  const data = board.list.data
  const loading = board.list.status === 'loading'

  return (
    <section
      id="board"
      role="tabpanel"
      aria-labelledby={`tab-${month.id}`}
      className={styles.board}
      onPointerEnter={(e) => e.pointerType === 'mouse' && board.setPaused(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && board.setPaused(false)}
      onFocus={(e) => e.target.matches(':focus-visible') && board.setPaused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && board.setPaused(false)}
    >
      <div className={styles.progress} data-active={loading || undefined} aria-hidden="true" />

      <p className={styles.boardHead}>
        <span>
          {month.status === 'upcoming' ? `Mở từ ${openDate(month.id)}` : data ? `${formatScore(data.total)} người tham gia` : 'Đang tải…'}
        </span>
        <LiveStatus
          status={month.status}
          socketStatus={socketStatus}
          updatedAt={board.updatedAt}
          holding={board.holding}
        />
      </p>

      {board.notice && (
        <p className={styles.notice} role="status">
          {board.notice}
        </p>
      )}

      <RankList
        list={board.list}
        page={board.page}
        changes={board.changes}
        onRetry={board.retryList}
        empty={EMPTY[month.status](month)}
      />

      <MyStandingCard
        me={board.me}
        listRevision={data?.revision ?? null}
        currentPage={board.page}
        monthStatus={month.status}
        onRetry={board.retryMe}
        onJump={board.goToPage}
      />

      <Pagination page={board.page} totalPages={data?.totalPages ?? 1} busy={loading} onChange={board.goToPage} />
    </section>
  )
}

interface LiveStatusProps {
  status: MonthStatus
  socketStatus: SocketStatus
  updatedAt: number | null
  holding: boolean
}

const openDate = (monthId: string) => {
  const [year, month] = monthId.split('-')
  return `01/${month}/${year}`
}

const EMPTY: Record<MonthStatus, (month: MonthMeta) => { title: string; text: string }> = {
  live: () => ({ title: 'Chưa có ai trên bảng', text: 'Người đầu tiên ghi điểm sẽ hiện ở đây ngay.' }),
  upcoming: (month) => ({ title: `${month.label} chưa bắt đầu`, text: `Bảng mở từ ngày ${openDate(month.id)}.` }),
  closed: () => ({ title: 'Chưa có ai trên bảng', text: 'Tháng này không có ai tham gia.' }),
}

function LiveStatus({ status, socketStatus, updatedAt, holding }: LiveStatusProps) {
  if (status === 'closed') return <span>Đã chốt kết quả</span>
  if (status === 'upcoming') return <span>Sắp mở</span>

  const at = updatedAt ? timeFormat.format(updatedAt) : null
  let text = at ? `Cập nhật lúc ${at}` : 'Đang kết nối…'
  if (socketStatus === 'disconnected') text = at ? `Mất kết nối · số liệu lúc ${at}` : 'Mất kết nối'
  else if (holding) text = 'Có điểm mới · đang giữ bảng cho bạn xem'

  return (
    <span className={styles.status} data-status={socketStatus} aria-live="polite">
      {text}
    </span>
  )
}
