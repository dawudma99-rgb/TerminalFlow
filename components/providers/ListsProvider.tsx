'use client'

/**
 * ListsProvider — Global provider for container lists management
 * 
 * Provides list-related state and operations app-wide:
 * - Fetches and caches lists for the current organization
 * - Manages active list selection (synced with profile.current_list_id)
 * - Exposes CRUD operations for lists
 * - Auto-creates default "Main List" if none exist
 * 
 * Usage:
 * ```tsx
 * const { lists, activeListId, setActiveList } = useListsContext()
 * ```
 */

import { createContext, useContext, ReactNode } from 'react'
import { useLists, type UseListsReturn } from '@/lib/data/useLists'

type ListsContextValue = UseListsReturn

const ListsContext = createContext<ListsContextValue | undefined>(undefined)

interface ListsProviderProps {
  children: ReactNode
}

/**
 * ListsProvider component
 * 
 * Wraps the app with list management context.
 */
export function ListsProvider({ children }: ListsProviderProps) {
  const listsData = useLists()

  return (
    <ListsContext.Provider value={listsData}>
      {children}
    </ListsContext.Provider>
  )
}

/**
 * useListsContext hook
 * 
 * Access list management state and operations from anywhere in the app.
 * 
 * @returns {ListsContextValue} List state and operations
 * @throws {Error} If called outside of ListsProvider
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { lists, activeListId, setActiveList, createList } = useListsContext()
 *   
 *   return (
 *     <div>
 *       {lists.map(list => (
 *         <button key={list.id} onClick={() => setActiveList(list.id)}>
 *           {list.name}
 *         </button>
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */
export function useListsContext(): ListsContextValue {
  const context = useContext(ListsContext)
  
  if (context === undefined) {
    throw new Error(
      'useListsContext must be used within a ListsProvider. ' +
      'Make sure ListsProvider is wrapped around your component tree.'
    )
  }
  
  return context
}


