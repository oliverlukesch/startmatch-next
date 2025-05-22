'use client'

import {useCallback, useEffect, useMemo, useRef, useState} from 'react'

import {TCollabThread, TiptapCollabProvider} from '@hocuspocus/provider'
import {CommentsKit, hoverOffThread, hoverThread} from '@tiptap-pro/extension-comments'
import {Collaboration} from '@tiptap/extension-collaboration'
import {CollaborationCursor} from '@tiptap/extension-collaboration-cursor'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import {EditorContent, useEditor} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import * as Y from 'yjs'

import {ThreadsList} from './ThreadsSidebar/components/ThreadsList'
import {ThreadsProvider, User} from './ThreadsSidebar/context'
import {useThreads} from './ThreadsSidebar/hooks/useThreads'
import './style.css'

function getOrCreateSubFragment(doc: Y.Doc, name: string): Y.XmlFragment {
  const defaultMap = doc.getMap('default')
  let subFragment = defaultMap.get(name) as Y.XmlFragment

  if (!subFragment || !(subFragment instanceof Y.XmlFragment)) {
    subFragment = new Y.XmlFragment()
    defaultMap.set(name, subFragment)
  }

  return subFragment
}

interface EditorProps {
  appId: string
  documentName: string
  user: User
}

export default function CollabEditor({appId, documentName, user}: EditorProps) {
  const [showUnresolved, setShowUnresolved] = useState(true)
  const [selectedThread, setSelectedThread] = useState<string | null>(null)
  const threadsRef = useRef<TCollabThread[]>([])
  const [synced, setSynced] = useState(false)
  const [selection, setSelection] = useState<{empty: boolean} | null>(null)

  const [yDoc, provider] = useMemo(() => {
    const yDoc = new Y.Doc()

    const providerInstance = new TiptapCollabProvider({
      appId: appId,
      name: documentName,
      document: yDoc,
      token: user.token,
    })

    return [yDoc, providerInstance]
  }, [appId, documentName, user.token])

  const subFragment = useMemo(() => {
    if (!synced) return null
    return getOrCreateSubFragment(yDoc, 'section-1')
  }, [yDoc, synced])

  useEffect(() => {
    const onSynced = () => {
      console.log('Provider synced')
      setSynced(true)
    }

    provider.on('synced', onSynced)

    return () => {
      provider.off('synced', onSynced)
    }
  }, [provider])

  const editor = useEditor(
    {
      onSelectionUpdate: ({editor: currentEditor}) => setSelection(currentEditor.state.selection),
      extensions: [
        StarterKit.configure({
          history: false,
        }),
        Image,
        ...(subFragment
          ? [
              Collaboration.configure({
                document: yDoc,
                fragment: subFragment,
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
                onClickThread: (threadId: string | null) => {
                  const isResolved = threadsRef.current.find(t => t.id === threadId)?.resolvedAt

                  if (!threadId || isResolved) {
                    setSelectedThread(null)
                    editor?.chain().unselectThread?.().run()
                    return
                  }

                  setSelectedThread(threadId)
                  editor?.chain().selectThread?.({id: threadId, updateSelection: false}).run()
                },
              }),
            ]
          : []),
        Placeholder.configure({
          placeholder: 'Write a text to add comments …',
        }),
      ],
    },
    [provider, user, subFragment, yDoc],
  )

  const {threads = [], createThread} = useThreads(provider, editor, user)

  threadsRef.current = threads

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
    <div className="tiptap-comments-test-editor">
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
        <div className="col-group" data-viewmode={showUnresolved ? 'open' : 'resolved'}>
          <div className="main">
            <div className="control-group">
              <div className="button-group">
                <button onClick={createThread} disabled={!selection || selection.empty}>
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
    </div>
  )
}
