'use client'

import { ME } from '@/config'
import { mockDb } from '@/data/mockDb'
import { NETWORK_PROFILES, network } from '@/data/network'
import { simulator } from '@/data/simulator'
import { useNetworkProfile, useSimulatorRunning, useSocketStatus } from '@/hooks/useRealtime'
import { socket } from '@/realtime/mockSocket'
import styles from './simulator.module.css'

export function SimulatorPanel() {
  const profile = useNetworkProfile()
  const running = useSimulatorRunning()
  const socketStatus = useSocketStatus()
  const liveMonth = mockDb.liveMonthId()
  const liveLabel = mockDb.listMonths().find((m) => m.id === liveMonth)?.label

  return (
    <details className={styles.panel}>
      <summary className={styles.summary}>Bảng mô phỏng dữ liệu &amp; mạng</summary>

      <div className={styles.body}>
        <fieldset className={styles.group}>
          <legend>Mạng của mock API</legend>
          <div className={styles.segmented}>
            {NETWORK_PROFILES.map((p) => (
              <label key={p.id} className={styles.option}>
                <input
                  type="radio"
                  name="network"
                  checked={profile.id === p.id}
                  onChange={() => network.set(p.id)}
                />
                <span>{p.label}</span>
              </label>
            ))}
          </div>
          <p className={styles.hint}>
            Trễ {profile.minLatency}–{profile.maxLatency}ms · lỗi {Math.round(profile.failRate * 100)}% · treo{' '}
            {Math.round(profile.stallRate * 100)}%
          </p>
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Realtime</legend>
          <div className={styles.actions}>
            <button type="button" onClick={() => (running ? simulator.stop() : simulator.start())}>
              {running ? 'Tạm dừng biến động tự động' : 'Bật biến động tự động'}
            </button>
            <button
              type="button"
              onClick={() => (socketStatus === 'disconnected' ? socket.connect() : socket.disconnect())}
            >
              {socketStatus === 'disconnected' ? 'Kết nối lại socket' : 'Ngắt kết nối socket'}
            </button>
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Tác động lên {liveLabel}</legend>
          <div className={styles.actions}>
            <button type="button" onClick={() => mockDb.addPlayer(liveMonth)}>
              Thêm người chơi mới
            </button>
            <button type="button" onClick={simulator.tick}>
              Một thay đổi ngẫu nhiên
            </button>
            <button type="button" onClick={() => mockDb.addScore(liveMonth, ME.id, 100)}>
              Cộng 100 điểm cho tôi
            </button>
            <button type="button" onClick={() => mockDb.tieAt(liveMonth, 10)}>
              Tạo đồng hạng ở cuối trang 1
            </button>
          </div>
        </fieldset>
      </div>
    </details>
  )
}
