'use client'

import {useCallback, useEffect, useMemo, useRef, useState} from 'react'

import {TCollabThread} from '@hocuspocus/provider'
import {TiptapCollabProvider} from '@hocuspocus/provider'
import {CommentsKit, hoverOffThread, hoverThread} from '@tiptap-pro/extension-comments'
import {Collaboration} from '@tiptap/extension-collaboration'
import {CollaborationCursor} from '@tiptap/extension-collaboration-cursor'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import {EditorContent, useEditor} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import * as Y from 'yjs'

import {Button} from '@/components/ui/button'
import {Label} from '@/components/ui/label'
import {RadioGroup, RadioGroupItem} from '@/components/ui/radio-group'

import {cn} from '@/lib/utils'

import {ThreadsList} from './components/ThreadsList'
import {ThreadsProvider} from './context'
import {useThreads} from './hooks/useThreads'
import './style.css'

function getOrCreateSubField(doc: Y.Doc, subFieldName: string): Y.XmlFragment {
  let defaultField = doc.get('default')
  if (!defaultField || !(defaultField instanceof Y.Map)) {
    defaultField = doc.getMap('default')
  }
  const defaultMap = defaultField as Y.Map<unknown>
  let subField = defaultMap.get(subFieldName)
  if (!subField || !(subField instanceof Y.XmlFragment)) {
    subField = new Y.XmlFragment()
    defaultMap.set(subFieldName, subField)
  }
  return subField as Y.XmlFragment
}

export interface EditorProps {
  appId: string
  documentName: string
  user: {
    name: string
    color: string
    token: string
  }
  className?: string
}

export const CollabEditor = ({appId, documentName, user, className}: EditorProps) => {
  const [showUnresolved, setShowUnresolved] = useState(true)
  const [selectedThread, setSelectedThread] = useState<string | null>(null)
  const [synced, setSynced] = useState(false)
  const threadsRef = useRef<TCollabThread[]>([])

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
      immediatelyRender: false,
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
                useLegacyWrapping: false,
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
    (threadId: string) => {
      editor?.chain().selectThread({id: threadId}).run()
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
    (threadId: number) => {
      if (editor) {
        hoverThread(editor, [threadId] as number[])
      }
    },
    [editor],
  )

  const onLeaveThread = useCallback(() => {
    if (editor) {
      hoverOffThread(editor)
    }
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
      <div className={cn('flex flex-row gap-4 lg:flex-row-reverse', className)}>
        <div className="flex-1">
          <div className="mb-4 flex items-center gap-2">
            <Button onClick={createThread} disabled={editor.state.selection.empty} size="sm">
              Add comment
            </Button>
            <Button
              onClick={() =>
                editor.chain().focus().setImage({src: 'https://placehold.co/800x500'}).run()
              }
              size="sm"
              variant="outline">
              Add image
            </Button>
          </div>
          <EditorContent editor={editor} className="rounded-lg border p-4" />
        </div>
        <div className="w-80 shrink-0 border-l pl-4">
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-2 text-sm font-semibold">Comments</div>
              <RadioGroup
                value={showUnresolved ? 'open' : 'resolved'}
                onValueChange={value => setShowUnresolved(value === 'open')}
                className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="open" id="thread-state-open" />
                  <Label htmlFor="thread-state-open">Open</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="resolved" id="thread-state-resolved" />
                  <Label htmlFor="thread-state-resolved">Resolved</Label>
                </div>
              </RadioGroup>
            </div>
            <ThreadsList provider={provider} threads={filteredThreads} />
          </div>
        </div>
      </div>
    </ThreadsProvider>
  )
}

export default CollabEditor
