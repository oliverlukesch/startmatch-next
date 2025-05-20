'use client'

import {useCallback, useEffect, useState} from 'react'

import {TCollabThread, TiptapCollabProvider} from '@hocuspocus/provider'
// import {subscribeToThreads} from '@tiptap-pro/extension-comments'
import {Editor} from '@tiptap/core'

interface UseThreadsReturn {
  threads: TCollabThread[] | undefined
  createThread: () => void
}

export const useThreads = (
  provider: TiptapCollabProvider,
  editor: Editor | null,
  user: {name: string},
): UseThreadsReturn => {
  const [threads, setThreads] = useState<TCollabThread[]>()

  // useEffect(() => {
  //   if (provider) {
  //     const unsubscribe = subscribeToThreads({
  //       provider,
  //       callback: (currentThreads: TCollabThread[]) => {
  //         console.log('currentThreads', currentThreads)
  //         setThreads(currentThreads)
  //       },
  //     })

  //     return () => {
  //       unsubscribe()
  //     }
  //   }
  // }, [provider])

  useEffect(() => {
    if (!provider) {
      return () => null
    }

    const getThreads = () => {
      setThreads(provider.getThreads())
    }

    getThreads()

    provider.watchThreads(getThreads)

    return () => {
      provider.unwatchThreads(getThreads)
    }
  }, [provider])

  const createThread = useCallback(() => {
    const input = window.prompt('Comment content')

    if (!input) {
      return
    }

    if (!editor) {
      return
    }

    editor
      .chain()
      .focus()
      .setThread({content: input, commentData: {userName: user.name}})
      .run()
  }, [editor, user])

  return {threads, createThread}
}
