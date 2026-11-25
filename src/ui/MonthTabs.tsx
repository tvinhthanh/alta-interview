import { useRef } from 'react'
import type { MonthMeta } from '@/data/leaderboardApi'
import { ChevronDown } from 'lucide-react'
import styles from './screen.module.css'

interface MonthTabsProps {
  months: MonthMeta[]
  activeId: string
  onSelect: (id: string) => void
}

// Desktop dùng dãy tab như thiết kế, mobile dùng <select> của hệ điều hành cho gọn.
export function MonthTabs({ months, activeId, onSelect }: MonthTabsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = (index + step + months.length) % months.length
    refs.current[next]?.focus()
    onSelect(months[next].id)
  }

  return (
    <>
      <div className={styles.tabs} role="tablist" aria-label="Chọn tháng">
        {months.map((month, index) => {
          const selected = month.id === activeId
          return (
            <button
              key={month.id}
              ref={(el) => {
                refs.current[index] = el
              }}
              type="button"
              role="tab"
              id={`tab-${month.id}`}
              aria-selected={selected}
              aria-controls="board"
              tabIndex={selected ? 0 : -1}
              className={styles.tab}
              onClick={() => onSelect(month.id)}
              onKeyDown={(e) => onKeyDown(e, index)}
            >
              {month.label}
            </button>
          )
        })}
      </div>

      <label className={styles.monthSelect}>
        <span className="sr-only">Chọn tháng</span>
        <select value={activeId} onChange={(e) => onSelect(e.target.value)}>
          {months.map((month) => (
            <option key={month.id} value={month.id}>
              {month.label}
              {month.status === 'live' ? ' · đang diễn ra' : month.status === 'upcoming' ? ' · sắp mở' : ''}
            </option>
          ))}
        </select>
        <ChevronDown className={styles.monthSelectIcon} size={20} aria-hidden />
      </label>
    </>
  )
}
