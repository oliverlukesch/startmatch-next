import {useCallback, useEffect, useState} from 'react'

import {TiptapCollabProvider} from '@hocuspocus/provider'
import {TCollabThread} from '@hocuspocus/provider'
import {subscribeToThreads} from '@tiptap-pro/extension-comments'
import {Editor} from '@tiptap/core'

// Define the User interface
interface User {
  name: string
}

// Hook return type
interface UseThreadsReturn {
  threads: TCollabThread[] | undefined
  createThread: () => void
}

export const useThreads = (
  provider: TiptapCollabProvider | null | undefined,
  editor: Editor | null | undefined,
  user: User,
): UseThreadsReturn => {
  const [threads, setThreads] = useState<TCollabThread[] | undefined>(undefined)

  useEffect(() => {
    if (provider) {
      const unsubscribe = subscribeToThreads({
        provider,
        callback: (currentThreads: TCollabThread[]) => {
          setThreads(currentThreads)
        },
      })

      return () => {
        unsubscribe()
      }
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
