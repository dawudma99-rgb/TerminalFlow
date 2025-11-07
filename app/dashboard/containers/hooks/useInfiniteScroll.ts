'use client'

import { useState, useMemo, useEffect, useRef } from 'react'

/**
 * Custom hook for infinite scroll pagination
 * 
 * Manages visible item count and scroll-based loading of additional items.
 * Automatically resets when filters change and handles edge cases.
 * 
 * @param items - Array of items to paginate
 * @param batchSize - Number of items to load per batch (default: 50)
 * @returns Visible items array and hasMore boolean
 */
export function useInfiniteScroll<T>(
  items: T[],
  batchSize: number = 50
): { visibleItems: T[]; hasMore: boolean } {
  const [visibleCount, setVisibleCount] = useState(batchSize)
  const previousItemsLengthRef = useRef(items.length)
  const previousItemsRef = useRef(items)

  // Reset visible count when items list changes (filter change or data update)
  useEffect(() => {
    const itemsChanged = previousItemsRef.current !== items
    const lengthDecreased = items.length < previousItemsLengthRef.current
    
    // Reset when filters change (items array reference changes) or list shrinks
    if (itemsChanged || (lengthDecreased && items.length < visibleCount)) {
      // Use setTimeout to defer the state update outside of the effect
      setTimeout(() => {
        setVisibleCount(Math.min(batchSize, items.length))
      }, 0)
    }
    
    previousItemsLengthRef.current = items.length
    previousItemsRef.current = items
  }, [items, visibleCount, batchSize])

  // Set up window scroll listener for infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
        setVisibleCount(prev => Math.min(prev + batchSize, items.length))
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [items.length, batchSize])

  // Slice items for pagination
  const visibleItems = useMemo(() => {
    const effectiveVisibleCount = items.length > 0 && visibleCount === 0 
      ? Math.min(batchSize, items.length)
      : visibleCount
    const sliced = items.slice(0, effectiveVisibleCount)
    return sliced
  }, [items, visibleCount, batchSize])

  // Check if more items are available
  const hasMore = visibleCount < items.length

  return { visibleItems, hasMore }
}

