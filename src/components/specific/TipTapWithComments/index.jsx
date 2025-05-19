'use client'

import {useCallback, useRef, useState} from 'react'

import {TiptapCollabProvider} from '@hocuspocus/provider'
import {CommentsKit, hoverOffThread, hoverThread} from '@tiptap-pro/extension-comments'
import {Collaboration} from '@tiptap/extension-collaboration'
import {CollaborationCursor} from '@tiptap/extension-collaboration-cursor'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import {EditorContent, useEditor} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {v4 as uuid} from 'uuid'
import * as Y from 'yjs'

import {ThreadsList} from './components/ThreadsList'
import {ThreadsProvider} from './context'
import {useThreads} from './hooks/useThreads'
import {useUser} from './hooks/useUser'
import './style.css'

const doc = new Y.Doc()

const isDev = true
const id = isDev ? 'dev' : uuid()

const provider = new TiptapCollabProvider({
  appId: '7j9y6m10',
  name: `tiptap-comments-demo/${id}`,
  document: doc,
})

export default () => {
  const [showUnresolved, setShowUnresolved] = useState(true)
  const [selectedThread, setSelectedThread] = useState(null)
  const threadsRef = useRef([])

  const user = useUser()

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        history: false,
      }),
      Image,
      Collaboration.configure({
        document: doc,
      }),
      CollaborationCursor.configure({
        provider,
        user: {
          name: user.name,
          color: user.color,
        },
      }),
      CommentsKit.configure({
        provider,
        useLegacyWrapping: false,
        onClickThread: threadId => {
          const isResolved = threadsRef.current.find(t => t.id === threadId)?.resolvedAt

          if (!threadId || isResolved) {
            setSelectedThread(null)
            editor?.chain().unselectThread().run()
            return
          }

          setSelectedThread(threadId)
          editor?.chain().selectThread({id: threadId, updateSelection: false}).run()
        },
      }),
      Placeholder.configure({
        placeholder: 'Write a text to add comments …',
      }),
    ],
  })

  const {threads = [], createThread} = useThreads(provider, editor, user)

  threadsRef.current = threads

  const selectThreadInEditor = useCallback(
    threadId => {
      editor.chain().selectThread({id: threadId}).run()
    },
    [editor],
  )

  const deleteThread = useCallback(
    threadId => {
      provider.deleteThread(threadId)
      editor.commands.removeThread({id: threadId})
    },
    [editor],
  )

  const resolveThread = useCallback(
    threadId => {
      editor.commands.resolveThread({id: threadId})
    },
    [editor],
  )

  const unresolveThread = useCallback(
    threadId => {
      editor.commands.unresolveThread({id: threadId})
    },
    [editor],
  )

  const updateComment = useCallback(
    (threadId, commentId, content, metaData) => {
      editor.commands.updateComment({
        threadId,
        id: commentId,
        content,
        data: metaData,
      })
    },
    [editor],
  )

  const onHoverThread = useCallback(
    threadId => {
      hoverThread(editor, [threadId])
    },
    [editor],
  )

  const onLeaveThread = useCallback(() => {
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
      selectedThreads={editor.storage.comments.focusedThreads}
      selectedThread={selectedThread}
      setSelectedThread={setSelectedThread}
      threads={threads}>
      <div className="col-group" data-viewmode={showUnresolved ? 'open' : 'resolved'}>
        <div className="main">
          <div className="control-group">
            <div className="button-group">
              <button onClick={createThread} disabled={editor.state.selection.empty}>
                Add comment
              </button>
              <button
                onClick={() =>
                  editor.chain().focus().setImage({src: 'https://placehold.co/800x500'}).run()
                }>
                Add image
              </button>
            </div>
          </div>
          <EditorContent editor={editor} />
        </div>
        <div className="sidebar">
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
      </div>
    </ThreadsProvider>
  )
}
