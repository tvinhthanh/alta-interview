'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { network } from '@/data/network'
import { simulator } from '@/data/simulator'
import { socket } from '@/realtime/mockSocket'

export function useRealtimeConnection() {
  useEffect(() => {
    socket.connect()
    simulator.start()
    return () => {
      socket.disconnect()
      simulator.stop()
    }
  }, [])
}

export const useSocketStatus = () =>
  useSyncExternalStore(socket.subscribeStatus, socket.getStatus, () => 'disconnected' as const)

export const useSimulatorRunning = () =>
  useSyncExternalStore(simulator.subscribe, simulator.isRunning, () => false)

export const useNetworkProfile = () => useSyncExternalStore(network.subscribe, network.get, network.get)
