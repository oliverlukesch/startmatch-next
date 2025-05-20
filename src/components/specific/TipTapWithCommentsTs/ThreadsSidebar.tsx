'use client'

import {useCallback, useState} from 'react'

import {TCollabThread, TiptapCollabProvider} from '@hocuspocus/provider'
import {hoverOffThread, hoverThread} from '@tiptap-pro/extension-comments'
import {Editor} from '@tiptap/react'

import {ThreadsList} from './components/ThreadsList'
import {ThreadsProvider, User} from './context'
import './style.css'

interface CommentsProps {
  editor: Editor | null
  provider: TiptapCollabProvider
  user: User
  threads: TCollabThread[]
  setSelectedThread: React.Dispatch<React.SetStateAction<string | null>>
  selectedThread: string | null
}

export default function ThreadsSidebar({
  editor,
  provider,
  user,
  threads,
  setSelectedThread,
  selectedThread,
}: CommentsProps) {
  const [showUnresolved, setShowUnresolved] = useState(true)

  const selectThreadInEditor = useCallback(
    (threadId: string) => {
      // RAF required to avoid a React rendering issue
      requestAnimationFrame(() => {
        editor?.chain().selectThread?.({id: threadId}).run()
      })
    },
    [editor],
  )

  const deleteThread = useCallback(
    (threadId: string) => {
      provider.deleteThread(threadId)
      editor?.commands.removeThread({id: threadId})
    },
    [editor, provider],
  )

  const resolveThread = useCallback(
    (threadId: string) => {
      editor?.commands.resolveThread({id: threadId})
    },
    [editor],
  )

  const unresolveThread = useCallback(
    (threadId: string) => {
      editor?.commands.unresolveThread({id: threadId})
    },
    [editor],
  )

  const updateComment = useCallback(
    (threadId: string, commentId: string, content: string, metaData?: Record<string, unknown>) => {
      editor?.commands.updateComment({
        threadId,
        id: commentId,
        content,
        data: metaData,
      })
    },
    [editor],
  )

  const onHoverThread = useCallback(
    (threadId: string) => {
      if (!editor) return
      hoverThread(editor, [threadId] as unknown as number[])
    },
    [editor],
  )

  const onLeaveThread = useCallback(() => {
    if (!editor) return
    hoverOffThread(editor)
  }, [editor])

  if (!editor) {
    return null
  }

  const filteredThreads = threads.filter(t => (showUnresolved ? !t.resolvedAt : !!t.resolvedAt))

  return (
    <ThreadsProvider
      onClickThread={selectThreadInEditor}
      onDeleteThread={deleteThread}
      onHoverThread={onHoverThread}
      onLeaveThread={onLeaveThread}
      onResolveThread={resolveThread}
      onUpdateComment={updateComment}
      onUnresolveThread={unresolveThread}
      selectedThreads={editor.storage.comments?.focusedThreads || []}
      selectedThread={selectedThread}
      setSelectedThread={setSelectedThread}
      threads={threads}
      user={user}>
      <div className="sidebar" data-viewmode={showUnresolved ? 'open' : 'resolved'}>
        <div className="sidebar-options">
          <div className="option-group">
            <div className="label-large">Comments</div>
            <div className="switch-group">
              <label>
                <input
                  type="radio"
                  name="thread-state"
                  onChange={() => setShowUnresolved(true)}
                  checked={showUnresolved}
                />
                Open
              </label>
              <label>
                <input
                  type="radio"
                  name="thread-state"
                  onChange={() => setShowUnresolved(false)}
                  checked={!showUnresolved}
                />
                Resolved
              </label>
            </div>
          </div>
          <ThreadsList provider={provider} threads={filteredThreads} />
        </div>
      </div>
    </ThreadsProvider>
  )
}
