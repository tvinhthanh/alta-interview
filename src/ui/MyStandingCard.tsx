import { PAGE_SIZE } from '@/config'
import type { MonthStatus, MyStanding } from '@/data/leaderboardApi'
import { pageOfPosition } from '@/domain/ranking'
import type { Resource } from '@/hooks/useLeaderboard'
import { RankRow } from './RankList'
import listStyles from './rankList.module.css'
import styles from './myStanding.module.css'

const NO_ENTRY_TEXT: Record<MonthStatus, string> = {
  live: 'Bạn chưa có điểm trong tháng này.',
  upcoming: 'Tháng này chưa bắt đầu.',
  closed: 'Bạn không tham gia tháng này.',
}

interface MyStandingCardProps {
  me: Resource<MyStanding>
  listRevision: number | null
  currentPage: number
  monthStatus: MonthStatus
  onRetry: () => void
  onJump: (page: number) => void
}

export function MyStandingCard({ me, listRevision, currentPage, monthStatus, onRetry, onJump }: MyStandingCardProps) {
  return (
    <section className={styles.wrap} aria-labelledby="my-standing">
      <h2 id="my-standing" className={styles.label}>
        Hạng của tôi
      </h2>
      <div className={styles.slot} aria-live="polite">
        <Content me={me} listRevision={listRevision} currentPage={currentPage} monthStatus={monthStatus} onRetry={onRetry} onJump={onJump} />
      </div>
    </section>
  )
}

function Content({ me, listRevision, currentPage, monthStatus, onRetry, onJump }: MyStandingCardProps) {
  if (me.status === 'error') {
    return (
      <p className={styles.note}>
        Chưa lấy được hạng của bạn. {me.error}{' '}
        <button type="button" className={styles.link} onClick={onRetry}>
          Thử lại
        </button>
      </p>
    )
  }

  if (!me.data) {
    return (
      <div className={`${listStyles.row} ${listStyles.skeleton}`} aria-label="Đang tải hạng của bạn">
        <span className={listStyles.boneRank} />
        <span className={listStyles.boneAvatar} />
        <span className={listStyles.boneName} style={{ width: '60%' }} />
        <span className={listStyles.boneScore} />
      </div>
    )
  }

  const { entry } = me.data
  if (!entry) {
    return (
      <p className={styles.note}>
        {NO_ENTRY_TEXT[monthStatus]}
      </p>
    )
  }

  // Hạng cá nhân phải đọc cùng revision với danh sách thì mới nhảy tới đúng trang.
  const stale = me.status === 'loading' || me.data.revision !== listRevision
  const myPage = pageOfPosition(entry.position, PAGE_SIZE)

  return (
    <div className={styles.card} data-stale={stale || undefined}>
      <RankRow entry={entry} as="div" />
      {myPage === currentPage ? (
        <p className={styles.here}>Bạn đang ở trang này</p>
      ) : (
        <button type="button" className={styles.link} onClick={() => onJump(myPage)} disabled={stale}>
          Xem trang {myPage}, nơi bạn đang đứng
        </button>
      )}
    </div>
  )
}
