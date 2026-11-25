'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import styles from './rankList.module.css'

/** Giữ họ và tên, bỏ tên đệm: "Tôn Nữ Hoàng Thị Phương Thảo Nguyên" thành "Tôn Nguyên". */
export function surnameAndGiven(name: string) {
  const words = name.trim().split(/\s+/)
  return words.length > 2 ? `${words[0]} ${words.at(-1)}` : name
}

// Tên đầy đủ vừa chỗ thì hiện đầy đủ; tràn thì bỏ tên đệm thay vì cắt "…" mất tên chính.
export function FitName({ name, className }: { name: string; className?: string }) {
  const box = useRef<HTMLSpanElement>(null)
  const probe = useRef<HTMLSpanElement>(null)
  const [short, setShort] = useState(false)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setShort((probe.current?.offsetWidth ?? 0) > el.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [name])

  return (
    <span ref={box} className={className} title={name}>
      <span aria-hidden="true">{short ? surnameAndGiven(name) : name}</span>
      <span className="sr-only">{name}</span>
      <span ref={probe} className={styles.probe} aria-hidden="true">
        {name}
      </span>
    </span>
  )
}
