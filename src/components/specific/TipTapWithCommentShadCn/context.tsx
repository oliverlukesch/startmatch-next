import {createContext, useCallback, useContext} from 'react'

import {TCollabThread} from '@hocuspocus/provider'

interface Comment {
  id: string
  content: string
  createdAt: number
  updatedAt: number
  deletedAt?: number
  data: {
    userName: string
  }
}

interface User {
  name: string
  color: string
  token: string
}

interface ThreadsContextValue {
  threads: TCollabThread[]
  selectedThreads: string[]
  selectedThread: string | null
  user: User | null

  onClickThread: (threadId: string) => void
  deleteThread: (threadId: string) => void
  resolveThread: (threadId: string) => void
  unresolveThread: (threadId: string) => void
  onUpdateComment: (
    threadId: string,
    commentId: string,
    content: string,
    metaData?: Record<string, unknown>,
  ) => void
  onHoverThread: (threadId: number) => void
  onLeaveThread: () => void
}

interface ThreadsProviderProps {
  children: React.ReactNode
  threads?: TCollabThread[]
  selectedThreads?: string[]
  selectedThread?: string | null
  user?: User | null
  onClickThread?: (threadId: string) => void
  onDeleteThread?: (threadId: string) => void
  onResolveThread?: (threadId: string) => void
  onUnresolveThread?: (threadId: string) => void
  onUpdateComment?: (
    threadId: string,
    commentId: string,
    content: string,
    metaData?: Record<string, unknown>,
  ) => void
  onHoverThread?: (threadId: number) => void
  onLeaveThread?: () => void
  setSelectedThread?: React.Dispatch<React.SetStateAction<string | null>>
}

export const ThreadsContext = createContext<ThreadsContextValue>({
  threads: [],
  selectedThreads: [],
  selectedThread: null,
  user: null,

  onClickThread: () => null,
  deleteThread: () => null,
  resolveThread: () => null,
  unresolveThread: () => null,
  onUpdateComment: () => null,
  onHoverThread: () => null,
  onLeaveThread: () => null,
})

export const ThreadsProvider = ({
  children,
  threads = [],
  selectedThreads = [],
  selectedThread = null,
  user = null,
  onClickThread = () => null,
  onDeleteThread = () => null,
  onResolveThread = () => null,
  onUnresolveThread = () => null,
  onUpdateComment = () => null,
  onHoverThread = () => null,
  onLeaveThread = () => null,
  setSelectedThread = () => null,
}: ThreadsProviderProps) => {
  const handleThreadClick = useCallback(
    (threadId: string) => {
      setSelectedThread((currentThreadId: string | null) => {
        if (currentThreadId !== threadId) {
          onClickThread(threadId)
          return threadId
        }
        return null
      })
    },
    [onClickThread, setSelectedThread],
  )

  const providerValue: ThreadsContextValue = {
    threads,
    selectedThreads,
    selectedThread,
    user,

    deleteThread: onDeleteThread,
    resolveThread: onResolveThread,
    unresolveThread: onUnresolveThread,
    onClickThread: handleThreadClick,
    onUpdateComment,
    onHoverThread,
    onLeaveThread,
  }

  return <ThreadsContext.Provider value={providerValue}>{children}</ThreadsContext.Provider>
}

export const useThreadsState = () => {
  return useContext(ThreadsContext)
}

// Export types for use in other components
export type {Comment, User, ThreadsContextValue, ThreadsProviderProps}
