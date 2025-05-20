'use client'

import {useCallback, useEffect, useMemo, useRef, useState} from 'react'

import {TiptapCollabProvider} from '@hocuspocus/provider'
import {CommentsKit, hoverOffThread, hoverThread} from '@tiptap-pro/extension-comments'
import {Collaboration} from '@tiptap/extension-collaboration'
import {CollaborationCursor} from '@tiptap/extension-collaboration-cursor'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import {EditorContent, useEditor} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import * as Y from 'yjs'

import {ThreadsList} from './components/ThreadsList.jsx'
import {ThreadsProvider} from './context.jsx'
import {useThreads} from './hooks/useThreads.jsx'
import './style.css'

function getOrCreateSubField(doc, subFieldName) {
  let defaultField = doc.get('default')
  if (!defaultField || !(defaultField instanceof Y.Map)) {
    defaultField = doc.getMap('default')
  }
  const defaultMap = defaultField
  let subField = defaultMap.get(subFieldName)
  if (!subField || !(subField instanceof Y.XmlFragment)) {
    subField = new Y.XmlFragment()
    defaultMap.set(subFieldName, subField)
  }
  return subField
}

export default ({appId, documentName, user}) => {
  const [showUnresolved, setShowUnresolved] = useState(true)
  const [selectedThread, setSelectedThread] = useState(null)
  const threadsRef = useRef([])
  const [synced, setSynced] = useState(false)
  const [selection, setSelection] = useState(null)

  const [yDoc, provider] = useMemo(() => {
    const yDocInstance = new Y.Doc()
    const providerInstance = new TiptapCollabProvider({
      appId: appId,
      name: documentName,
      document: yDocInstance,
      ...(user.token && {token: user.token}),
    })
    return [yDocInstance, providerInstance]
  }, [appId, documentName, user.token])

  const childFragment = useMemo(() => {
    if (!synced) return null
    return getOrCreateSubField(yDoc, 'comments-fragment')
  }, [synced, yDoc])

  useEffect(() => {
    const onSynced = () => {
      console.log('Synced (Comments Editor)')
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
        ...(childFragment
          ? [
              Collaboration.configure({
                document: yDoc,
                fragment: childFragment,
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
                onClickThread: threadId => {
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
    [provider, user, childFragment, yDoc],
  )

  const {threads = [], createThread} = useThreads(provider, editor, user)

  threadsRef.current = threads

  const selectThreadInEditor = useCallback(
    threadId => {
      // RAF required to avoid a React rendering issue
      requestAnimationFrame(() => {
        editor.chain().selectThread?.({id: threadId}).run()
      })
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
