'use client'

import { useState } from 'react'
import styles from './rankList.module.css'

function hueOf(id: string) {
  let hash = 2166136261
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619)
  return (hash >>> 0) % 360
}

function initials(name: string) {
  const words = name.trim().split(/\s+/)
  const last = words.at(-1) ?? ''
  const first = words.length > 1 ? words[0] : ''
  return (first.charAt(0) + last.charAt(0)).toUpperCase()
}

interface AvatarProps {
  id: string
  name: string
  src?: string
  isMe?: boolean
}

export function Avatar({ id, name, src, isMe }: AvatarProps) {
  const [broken, setBroken] = useState(false)

  return (
    <span className={styles.avatarWrap} data-me={isMe || undefined}>
      <span className={styles.avatar} style={{ '--avatar-hue': hueOf(id) } as React.CSSProperties} aria-hidden="true">
        {initials(name)}
        {src && !broken && (
          <img className={styles.avatarImg} src={src} alt="" width={32} height={32} loading="lazy" onError={() => setBroken(true)} />
        )}
      </span>
      {isMe && <span className={styles.meBadge}>bạn</span>}
    </span>
  )
}
