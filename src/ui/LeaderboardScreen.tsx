'use client'

import { useState } from 'react'
import { useMonths } from '@/hooks/useMonths'
import { useRealtimeConnection } from '@/hooks/useRealtime'
import { MonthBoard } from './MonthBoard'
import { MonthTabs } from './MonthTabs'
import { RankList } from './RankList'
import { SimulatorPanel } from './SimulatorPanel'
import styles from './screen.module.css'
import listStyles from './rankList.module.css'

const LOADING = { status: 'loading', data: null, error: null } as const

export function LeaderboardScreen() {
  useRealtimeConnection()
  const months = useMonths()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const list = months.data ?? []
  const active = list.find((m) => m.id === selectedId) ?? list.find((m) => m.status === 'live') ?? list.at(-1)

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Bảng xếp hạng tháng</h1>

      {months.status === 'error' ? (
        <section className={styles.board}>
          <div className={listStyles.message} role="alert">
            <p className={listStyles.messageTitle}>Không tải được danh sách tháng</p>
            <p className={listStyles.messageText}>{months.error}</p>
            <button type="button" className={listStyles.retry} onClick={months.retry}>
              Thử lại
            </button>
          </div>
        </section>
      ) : active ? (
        <>
          <MonthTabs months={list} activeId={active.id} onSelect={setSelectedId} />
          <MonthBoard key={active.id} month={active} />
        </>
      ) : (
        <>
          <div className={styles.tabs} aria-hidden="true">
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} className={styles.tabSkeleton} />
            ))}
          </div>
          <div className={`${styles.monthSelect} ${styles.selectSkeleton}`} aria-hidden="true" />
          <section className={styles.board}>
            <RankList list={LOADING} page={1} changes={{}} empty={{ title: '', text: '' }} onRetry={() => {}} />
          </section>
        </>
      )}

      <SimulatorPanel />
    </main>
  )
}
