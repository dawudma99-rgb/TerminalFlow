'use client'

/**
 * useContainers — React hook for managing container data
 * Uses SWR for caching and background revalidation.
 */

import useSWR from 'swr'
import { fetchContainers } from './containers-actions'
import type { ContainerRecordWithComputed } from './containers-actions'

export type ContainerWithComputed = ContainerRecordWithComputed

const fetcher = async () => {
  console.time('fetchContainers latency')
  const data = await fetchContainers()
  console.timeEnd('fetchContainers latency')
  return data
}

export function useContainers() {
  const { data, error, isLoading, mutate } = useSWR('containers', fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 60000, // refresh every minute
  })

  return {
    containers: data ?? [],
    loading: isLoading,
    error: error as Error | null,
    reload: () => mutate(),
  }
}
