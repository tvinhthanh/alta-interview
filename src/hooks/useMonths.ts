'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { describeError, isAborted } from '@/data/errors'
import { fetchMonths, type MonthMeta } from '@/data/leaderboardApi'
import { LatestOnly } from '@/lib/latestOnly'
import type { Resource } from './useLeaderboard'

export function useMonths() {
  const [state, setState] = useState<Resource<MonthMeta[]>>({ status: 'loading', data: null, error: null })
  const request = useRef(new LatestOnly())

  const load = useCallback(async () => {
    const req = request.current.start()
    setState((s) => ({ ...s, status: 'loading', error: null }))
    try {
      const data = await fetchMonths(req.signal)
      if (req.isCurrent()) setState({ status: 'success', data, error: null })
    } catch (err) {
      if (req.isCurrent() && !isAborted(err)) setState({ status: 'error', data: null, error: describeError(err) })
    }
  }, [])

  useEffect(() => {
    const req = request.current
    load()
    return () => req.cancel()
  }, [load])

  return { ...state, retry: load }
}
