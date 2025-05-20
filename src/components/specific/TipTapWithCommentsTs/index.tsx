'use client'

import {useEffect, useMemo, useRef, useState} from 'react'

import {TiptapCollabProvider} from '@hocuspocus/provider'
import {CommentsKit} from '@tiptap-pro/extension-comments'
import {Collaboration} from '@tiptap/extension-collaboration'
import {CollaborationCursor} from '@tiptap/extension-collaboration-cursor'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import {EditorContent, useEditor} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import * as Y from 'yjs'

import {ThreadsSidebar, ThreadsSidebarRef} from './ThreadsSidebar'
import {User} from './context'
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

  const [selection, setSelection] = useState<{empty: boolean} | null>(null)
  const threadsSidebarRef = useRef<ThreadsSidebarRef>(null)

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
                  threadsSidebarRef.current?.onClickThread(threadId)
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

  if (!editor) return null

  return (
    <div className="tiptap-comments-test-editor">
      <div className="col-group">
        <div className="main">
          <div className="control-group">
            <div className="button-group">
              <button
                onClick={threadsSidebarRef.current?.createThread}
                disabled={!selection || selection.empty}>
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

        <ThreadsSidebar editor={editor} provider={provider} user={user} ref={threadsSidebarRef} />
      </div>
    </div>
  )
}
