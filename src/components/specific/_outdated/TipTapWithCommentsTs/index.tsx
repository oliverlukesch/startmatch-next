'use client'

import {useEffect, useMemo, useRef, useState} from 'react'

import {TiptapCollabProvider} from '@hocuspocus/provider'
import {CommentsKit} from '@tiptap-pro/extension-comments'
import {EditorEvents} from '@tiptap/core'
import {Collaboration} from '@tiptap/extension-collaboration'
import {CollaborationCursor} from '@tiptap/extension-collaboration-cursor'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import {EditorContent, useEditor} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import * as Y from 'yjs'

import {ThreadsSidebar, ThreadsSidebarRef} from './ThreadsSidebar'
import {User} from './ThreadsSidebar/context'
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
  const [synced, setSynced] = useState(false)

  const [selection, onSelectionUpdate] = useState<EditorEvents['selectionUpdate'] | null>(null)
  const threadsSidebarRef = useRef<ThreadsSidebarRef>(null)

  const [showUnresolved, setShowUnresolved] = useState(true)

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

  const subFragment2 = useMemo(() => {
    if (!synced) return null
    return getOrCreateSubFragment(yDoc, 'section-2')
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
                  threadsSidebarRef.current?.onClickThread(threadId)
                },
                useLegacyWrapping: false,
                deleteUnreferencedThreads: false,
              }),
            ]
          : []),
        Placeholder.configure({
          placeholder: 'Write a text to add comments …',
        }),
      ],
      onSelectionUpdate,
      onBlur: () => {
        console.log('editor 1 blurred')
        editor?.chain().unselectThread?.().run()
      },
    },
    [provider, user, subFragment, yDoc],
  )

  const editor2 = useEditor(
    {
      extensions: [
        StarterKit.configure({
          history: false,
        }),
        Image,
        ...(subFragment2
          ? [
              Collaboration.configure({
                document: yDoc,
                fragment: subFragment2,
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
                  threadsSidebarRef.current?.onClickThread(threadId)
                },
                useLegacyWrapping: false,
                deleteUnreferencedThreads: false,
              }),
            ]
          : []),
        Placeholder.configure({
          placeholder: 'Write a text to add comments …',
        }),
      ],
      onSelectionUpdate,
      onBlur: () => {
        console.log('editor 2 blurred')
        editor?.chain().unselectThread?.().run()
      },
    },
    [provider, user, subFragment2, yDoc],
  )

  if (!editor) return null

  return (
    <div className="tiptap-comments-test-editor">
      <div className="col-group">
        <div className="main" data-viewmode={showUnresolved ? 'open' : 'resolved'}>
          <div className="control-group">
            <div className="button-group">
              <button onClick={threadsSidebarRef.current?.createThread} disabled={!selection}>
                Add comment
              </button>
              <button
                onClick={() =>
                  editor.chain().focus().setImage({src: 'https://placehold.co/800x500'}).run()
                }>
                Add image
              </button>
              <button onClick={() => console.log(yDoc.toJSON())}>Log document</button>
            </div>
          </div>
          Editor 1
          <EditorContent editor={editor} />
          Editor 2
          <EditorContent editor={editor2} />
        </div>

        <ThreadsSidebar
          editor={selection?.editor || editor}
          provider={provider}
          user={user}
          ref={threadsSidebarRef}
          showUnresolved={showUnresolved}
          setShowUnresolved={setShowUnresolved}
        />
      </div>
    </div>
  )
}
