'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ME, PAGE_SIZE } from '@/config'
import type { LeaderboardPage } from '@/data/leaderboardApi'
import { isPodium, type RankedEntry, type RowChange } from '@/domain/ranking'
import type { Resource } from '@/hooks/useLeaderboard'
import { Avatar } from './Avatar'
import { FitName } from './FitName'
import { Crown } from 'lucide-react'
import styles from './rankList.module.css'

const scoreFormat = new Intl.NumberFormat('vi-VN')
export const formatScore = (score: number) => scoreFormat.format(score)

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface RankListProps {
  list: Resource<LeaderboardPage>
  page: number
  changes: Record<string, RowChange>
  empty: { title: string; text: string }
  onRetry: () => void
}

export function RankList({ list, page, changes, empty, onRetry }: RankListProps) {
  const listEl = useRef<HTMLOListElement>(null)
  useSlideRows(listEl, list.data)

  if (list.status === 'error') {
    return (
      <div className={styles.message} role="alert">
        <p className={styles.messageTitle}>Không tải được trang {page}</p>
        <p className={styles.messageText}>{list.error}</p>
        <button type="button" className={styles.retry} onClick={onRetry}>
          Thử lại
        </button>
      </div>
    )
  }

  // Trang chưa có trong cache thì hiện skeleton cùng kích thước dòng thật trong lúc tải.
  if (list.status === 'loading' || !list.data) return <SkeletonList />

  if (list.data.total === 0) {
    return (
      <div className={styles.message}>
        <p className={styles.messageTitle}>{empty.title}</p>
        <p className={styles.messageText}>{empty.text}</p>
      </div>
    )
  }

  return (
    <ol ref={listEl} className={styles.grid} aria-label={`Trang ${list.data.page}`}>
      {list.data.items.map((entry, index) => (
        <RankRow key={entry.id} entry={entry} change={changes[entry.id]} index={index} />
      ))}
    </ol>
  )
}

// FLIP: nhớ vị trí cũ của từng dòng, sau khi render thì trượt từ vị trí cũ về vị trí mới.
// Đo theo offset trong bảng (không theo viewport) để việc cuộn trang không bị hiểu nhầm là dòng đã di chuyển.
const positionOf = (row: HTMLElement) => ({ left: row.offsetLeft, top: row.offsetTop })

function useSlideRows(listEl: React.RefObject<HTMLOListElement | null>, data: unknown) {
  const lastRects = useRef(new Map<string, { left: number; top: number }>())

  useLayoutEffect(() => {
    const el = listEl.current
    if (!el) return
    const rows = Array.from(el.children) as HTMLElement[]

    if (!prefersReducedMotion()) {
      for (const row of rows) {
        const before = lastRects.current.get(row.dataset.id ?? '')
        if (!before) continue
        const now = positionOf(row)
        const dx = before.left - now.left
        const dy = before.top - now.top
        if (dx || dy) {
          row.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
            duration: 420,
            easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
          })
        }
      }
    }
    lastRects.current = new Map(rows.map((row) => [row.dataset.id ?? '', positionOf(row)]))
  }, [listEl, data])
}

function useCountUp(value: number, duration = 650) {
  const [shown, setShown] = useState(value)
  const fromRef = useRef(value)

  useEffect(() => {
    const from = fromRef.current
    fromRef.current = value
    if (from === value) return
    if (prefersReducedMotion()) return setShown(value)

    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      setShown(Math.round(from + (value - from) * (1 - (1 - t) ** 3)))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return shown
}

function usePulse(ref: React.RefObject<HTMLElement | null>, change?: RowChange) {
  useEffect(() => {
    const el = ref.current
    // Chỉ dòng tự đổi điểm mới nháy; dòng bị đẩy theo chỉ trượt, tránh cả bảng nhấp nháy.
    if (!el || !change?.scoreDelta || prefersReducedMotion()) return
    const rising = change.scoreDelta > 0

    const style = getComputedStyle(el)
    const tint = style.getPropertyValue(rising ? '--pulse-up' : '--pulse-down').trim()
    el.animate([{ backgroundColor: tint }, { backgroundColor: style.backgroundColor }], {
      duration: 1100,
      easing: 'ease-out',
    })
  }, [ref, change])
}

interface RankRowProps {
  entry: RankedEntry
  change?: RowChange
  index?: number
  as?: 'li' | 'div'
}

export function RankRow({ entry, change, index = 0, as: Tag = 'li' }: RankRowProps) {
  const ref = useRef<HTMLElement>(null)
  const score = useCountUp(entry.score)
  usePulse(ref, change)

  const podium = isPodium(entry.rank) ? entry.rank : undefined
  const isMe = entry.id === ME.id

  return (
    <Tag
      ref={ref as React.Ref<never>}
      className={styles.row}
      data-id={entry.id}
      data-podium={podium}
      data-me={isMe || undefined}
      data-entered={change?.entered || undefined}
      style={{ '--i': index } as React.CSSProperties}
    >
      <span className={styles.rank}>
        <span className="sr-only">Hạng </span>
        {podium ? entry.rank : `#${entry.rank}`}
        {entry.tied && <span className="sr-only">, đồng hạng</span>}
      </span>
      <Avatar id={entry.id} name={entry.name} src={entry.avatarUrl} isMe={isMe} />
      <FitName name={entry.name} className={styles.name} />
      {podium && <Crown className={styles.crown} size={18} strokeWidth={2.25} aria-hidden />}
      {change?.move ? (
        <span key={entry.rank} className={styles.move} data-dir={change.move > 0 ? 'up' : 'down'}>
          <span aria-hidden="true">{change.move > 0 ? '↑' : '↓'}</span>
          {Math.abs(change.move)}
          <span className="sr-only">{change.move > 0 ? ' hạng tăng' : ' hạng giảm'}</span>
        </span>
      ) : null}
      <span className={styles.score}>
        <span aria-hidden="true">{formatScore(score)}</span>
        <span className="sr-only">{formatScore(entry.score)} điểm</span>
      </span>
    </Tag>
  )
}

function SkeletonList() {
  return (
    <ol className={styles.grid} aria-busy="true" aria-label="Đang tải bảng xếp hạng">
      {Array.from({ length: PAGE_SIZE }, (_, i) => (
        <li key={i} className={`${styles.row} ${styles.skeleton}`}>
          <span className={styles.boneRank} />
          <span className={styles.boneAvatar} />
          <span className={styles.boneName} style={{ width: `${55 + ((i * 37) % 35)}%` }} />
          <span className={styles.boneScore} />
        </li>
      ))}
    </ol>
  )
}
