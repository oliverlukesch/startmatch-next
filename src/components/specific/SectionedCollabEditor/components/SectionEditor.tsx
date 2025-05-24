'use client'

import {memo, useEffect, useMemo, useState} from 'react'

import {TiptapCollabProvider} from '@hocuspocus/provider'
import Ai from '@tiptap-pro/extension-ai'
import AiChanges from '@tiptap-pro/extension-ai-changes'
import CollaborationHistory from '@tiptap-pro/extension-collaboration-history'
import {Editor, EditorEvents} from '@tiptap/core'
import {Collaboration} from '@tiptap/extension-collaboration'
import {CollaborationCursor} from '@tiptap/extension-collaboration-cursor'
import {EditorContent, useEditor} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {LoaderCircle} from 'lucide-react'
import * as Y from 'yjs'

import {Button} from '@/components/ui/button'

import {cn} from '@/lib/utils'

import {
  getCanActivateLock,
  getIsEditable,
  getLockInfo,
  setLockInfo,
} from '../helpers/docConfigHelpers'
import {getOrCreateSubXmlFragment} from '../helpers/yJsHelpers'
import {DocConfig, LockInfo, LockType, docConfigKeys} from '../types'

export interface SectionEditorProps {
  sectionName: string
  provider: TiptapCollabProvider
  aiAppId: string
  user: {
    id: string
    name: string
    color: string
    docToken: string
    aiToken: string
  }
  yDoc: Y.Doc
  isProviderSynced: boolean
  setActiveSection: (params: {name: string; editor: Editor | null}) => void
  isPrimary: boolean
  setPrimaryEditor: (editor: Editor | null) => void
  // required to trigger a re-render of the PrimaryToolbar when the selection
  // changes (which is required for highlighting the correct buttons)
  onSelectionUpdate: (data: EditorEvents['selectionUpdate']) => void
}

// TODO: take another stab at render performance, see here:
// https://tiptap.dev/docs/editor/getting-started/install/react#optimize-your-performance
export const SectionEditor = memo(function SectionEditor({
  sectionName,
  provider,
  aiAppId,
  user,
  yDoc,
  isProviderSynced,
  setActiveSection,
  isPrimary,
  setPrimaryEditor,
  onSelectionUpdate,
}: SectionEditorProps) {
  // leave for debugging
  // console.log('render SectionEditor', sectionName)

  const [sectionUserLock, setSectionUserLock] = useState<LockInfo>({active: false})
  const [sectionAiEdit, setSectionAiEdit] = useState<LockInfo>({active: false})

  const [isEditable, setIsEditable] = useState(true)
  const [isAiEditing, setIsAiEditing] = useState(false)
  const [hasAiChanges, setHasAiChanges] = useState(false)

  const subFragment = useMemo(() => {
    if (!isProviderSynced) return null
    return getOrCreateSubXmlFragment(yDoc, sectionName)
  }, [sectionName, yDoc, isProviderSynced])

  const docConfig = useMemo(() => {
    if (!isProviderSynced) return undefined
    return yDoc.getMap<DocConfig>(docConfigKeys.mapName)
  }, [yDoc, isProviderSynced])

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          history: false,
        }),
        // no need to configure the heavy extensions until the provider is
        // synced and the subFragment is available
        ...(subFragment
          ? [
              // ai extensions
              Ai.configure({
                appId: aiAppId,
                token: user.aiToken,
                // does not appear to be working, therefore disabled
                autocompletion: false,
                onLoading: () => {
                  setIsAiEditing(true)
                },
                onSuccess: context => {
                  setIsAiEditing(false)
                  setHasAiChanges(context.editor.extensionStorage.aiChanges.getChanges().length > 0)
                },
                onError: (error, context) => {
                  console.error(error)
                  setIsAiEditing(false)
                  context.editor.commands.stopTrackingAiChanges()
                },
              }),
              // TODO: add AI suggestions
              AiChanges.configure({
                // optional according to the documentation but that's a lie
                getCustomDecorations({getDefaultDecorations}) {
                  return getDefaultDecorations()
                },
              }),

              // collaboration extensions
              Collaboration.configure({
                document: yDoc,
                fragment: subFragment,
              }),
              CollaborationCursor.configure({
                provider,
                user,
              }),
              CollaborationHistory.configure({
                provider,
              }),
            ]
          : []),
      ],
      // helps with SSR
      immediatelyRender: false,
      // false is default in V3, might increase performance
      shouldRerenderOnTransaction: false,
      onFocus: () => {
        setActiveSection({name: sectionName, editor})
      },
      onSelectionUpdate,
    },
    [sectionName, provider, user, subFragment],
  )

  useEffect(() => {
    if (!docConfig) return

    const observedKeys = [
      // document-level keys
      ...Object.values(docConfigKeys.doc.userLock),
      ...Object.values(docConfigKeys.doc.aiEdit),
      // section-level keys
      ...Object.values(docConfigKeys.sections(sectionName).userLock),
      ...Object.values(docConfigKeys.sections(sectionName).aiEdit),
    ]

    function updateLockStates() {
      setSectionUserLock(getLockInfo(docConfig!, LockType.UserLock, sectionName))
      setSectionAiEdit(getLockInfo(docConfig!, LockType.AiEdit, sectionName))
      setIsEditable(getIsEditable(docConfig!, sectionName))
    }

    // initial update
    updateLockStates()

    function onDocConfigUpdate(event: Y.YMapEvent<DocConfig>) {
      const hasRelevantChange = Array.from(event.keysChanged).some(key =>
        observedKeys.includes(key),
      )

      if (hasRelevantChange) updateLockStates()
    }

    docConfig.observe(onDocConfigUpdate)

    return () => {
      docConfig.unobserve(onDocConfigUpdate)
    }
  }, [docConfig, sectionName])

  useEffect(() => {
    if (isPrimary) setPrimaryEditor(editor)
  }, [editor, isPrimary, setPrimaryEditor])

  useEffect(() => {
    if (editor) editor.setEditable(isEditable)
  }, [editor, isEditable])

  return (
    editor && (
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <h4 className="text-md inline font-semibold text-muted-foreground uppercase">
            {sectionName}
          </h4>

          {isAiEditing && <LoaderCircle className="size-5 animate-spin" />}

          {/* LOCK INFO */}
          {(sectionUserLock.active || sectionAiEdit.active) && (
            <div
              className={cn(
                'rounded px-1 py-0.5 text-sm',
                sectionUserLock.active ? 'bg-yellow-200' : 'bg-blue-200',
              )}>
              {sectionUserLock.active ? '🔒 Section locked by ' : '🤖 AI edit triggered by '}
              <span className="font-semibold">
                {sectionUserLock.active ? sectionUserLock.userName : sectionAiEdit.userName}
              </span>
            </div>
          )}
        </div>

        {/* CONTROLS */}
        <div className="flex gap-2">
          <Button
            variant={sectionUserLock.active ? 'destructive' : 'outline'}
            disabled={
              !docConfig ||
              (!sectionUserLock.active &&
                !getCanActivateLock(docConfig, LockType.UserLock, sectionName))
            }
            onClick={() => {
              if (!docConfig) return
              setLockInfo(
                docConfig,
                LockType.UserLock,
                !sectionUserLock.active,
                {
                  userId: user.id,
                  name: user.name,
                },
                sectionName,
              )
            }}>
            {sectionUserLock.active ? 'Unlock' : 'Lock'}
          </Button>

          <Button
            variant={sectionAiEdit.active ? 'destructive' : 'outline'}
            disabled={
              !docConfig ||
              (!sectionAiEdit.active &&
                !getCanActivateLock(docConfig, LockType.AiEdit, sectionName))
            }
            onClick={() => {
              if (!docConfig) return
              setLockInfo(
                docConfig,
                LockType.AiEdit,
                !sectionAiEdit.active,
                {
                  userId: user.id,
                  name: user.name,
                },
                sectionName,
              )
            }}>
            {sectionAiEdit.active ? 'Stop AI' : 'Start AI'}
          </Button>

          {hasAiChanges && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  editor.chain().acceptAllAiChanges().stopTrackingAiChanges().run()
                  setHasAiChanges(false)
                }}>
                Accept all
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  editor.chain().rejectAllAiChanges().stopTrackingAiChanges().run()
                  setHasAiChanges(false)
                }}>
                Reject all
              </Button>
            </>
          )}
        </div>

        <EditorContent
          editor={editor}
          className={cn(
            'rounded-lg bg-slate-50 p-4 focus-within:bg-amber-50',
            !isEditable && 'cursor-not-allowed opacity-50 select-none',
          )}
        />
      </div>
    )
  )
})
