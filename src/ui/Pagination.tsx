import { pageWindow } from '@/domain/ranking'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import styles from './pagination.module.css'

interface PaginationProps {
  page: number
  totalPages: number
  busy: boolean
  onChange: (page: number) => void
}

export function Pagination({ page, totalPages, busy, onChange }: PaginationProps) {
  // Giữ chỗ để tháng ít người hoặc lúc đang tải không làm khung bảng co lại.
  if (totalPages <= 1) return <div className={styles.pagination} aria-hidden="true" />

  return (
    <nav className={styles.pagination} aria-label="Phân trang">
      <button
        type="button"
        className={styles.arrow}
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Trang trước"
      >
        <ChevronLeft size={20} aria-hidden />
      </button>

      {pageWindow(page, totalPages).map((slot, i) =>
        slot === 'gap' ? (
          <span key={`gap-${i}`} className={styles.gap} aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={slot}
            type="button"
            className={styles.page}
            onClick={() => onChange(slot)}
            aria-current={slot === page ? 'page' : undefined}
            data-loading={(slot === page && busy) || undefined}
            aria-label={`Trang ${slot}`}
          >
            {slot}
          </button>
        ),
      )}

      <button
        type="button"
        className={styles.arrow}
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Trang sau"
      >
        <ChevronRight size={20} aria-hidden />
      </button>
    </nav>
  )
}
