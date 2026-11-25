import { mockDb } from '@/data/mockDb'
import type { ChangeEvent } from '@/domain/ranking'

// Sự kiện tới với độ trễ ngẫu nhiên nên có thể lệch thứ tự. Client so theo revision, không theo thứ tự nhận.

export type SocketStatus = 'disconnected' | 'connecting' | 'connected'

interface EventMap {
  'leaderboard:changed': ChangeEvent
  /** Gửi ngay khi kết nối (lại): revision mới nhất của từng tháng, để bù phần đã lỡ lúc mất kết nối. */
  sync: Record<string, number>
}

type Handler<K extends keyof EventMap> = (payload: EventMap[K]) => void

class MockSocket {
  private status: SocketStatus = 'disconnected'
  private handlers: { [K in keyof EventMap]: Set<Handler<K>> } = {
    'leaderboard:changed': new Set(),
    sync: new Set(),
  }
  private statusListeners = new Set<() => void>()
  private connectTimer: ReturnType<typeof setTimeout> | null = null
  private unsubscribeDb: (() => void) | null = null

  getStatus = () => this.status

  subscribeStatus = (fn: () => void) => {
    this.statusListeners.add(fn)
    return () => {
      this.statusListeners.delete(fn)
    }
  }

  on<K extends keyof EventMap>(event: K, handler: Handler<K>) {
    this.handlers[event].add(handler)
    return () => this.off(event, handler)
  }

  off<K extends keyof EventMap>(event: K, handler: Handler<K>) {
    this.handlers[event].delete(handler)
  }

  connect() {
    if (this.status !== 'disconnected') return
    this.setStatus('connecting')
    this.connectTimer = setTimeout(() => {
      this.connectTimer = null
      this.unsubscribeDb = mockDb.subscribe((event) => {
        setTimeout(() => {
          if (this.status === 'connected') this.emit('leaderboard:changed', event)
        }, 30 + Math.random() * 120)
      })
      this.setStatus('connected')
      this.emit('sync', mockDb.latestRevisions())
    }, 400 + Math.random() * 500)
  }

  disconnect() {
    if (this.connectTimer) clearTimeout(this.connectTimer)
    this.connectTimer = null
    this.unsubscribeDb?.()
    this.unsubscribeDb = null
    this.setStatus('disconnected')
  }

  private emit<K extends keyof EventMap>(event: K, payload: EventMap[K]) {
    this.handlers[event].forEach((handler) => handler(payload))
  }

  private setStatus(status: SocketStatus) {
    this.status = status
    this.statusListeners.forEach((fn) => fn())
  }
}

export const socket = new MockSocket()
