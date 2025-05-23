'use client'

import {memo, useEffect, useMemo, useState} from 'react'

import {TiptapCollabProvider} from '@hocuspocus/provider'
import Ai from '@tiptap-pro/extension-ai'
import AiChanges from '@tiptap-pro/extension-ai-changes'
import CollaborationHistory, {
  CollabOnUpdateProps,
} from '@tiptap-pro/extension-collaboration-history'
import {Editor, EditorEvents} from '@tiptap/core'
import {Collaboration} from '@tiptap/extension-collaboration'
import {CollaborationCursor} from '@tiptap/extension-collaboration-cursor'
import {EditorContent, useEditor} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import * as Y from 'yjs'

import {Button} from '@/components/ui/button'

import {cn} from '@/lib/utils'

import {canActivateLock, getLockInfo, isEditable, setLockInfo} from './settingsHelpers'
import {DocSettings, LockInfo, LockType, docSettingsKeys} from './types'
import {getOrCreateSubXmlFragment} from './utils'

export interface EditorSectionProps {
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
  // required as CollaborationHistory only works inside the editor context
  onPrimaryHistoryUpdate: (data: CollabOnUpdateProps) => void
  // required to trigger a re-render of the EditorToolbar when the selection
  // changes (which is required for highlighting the correct buttons)
  onSelectionUpdate: (data: EditorEvents['selectionUpdate']) => void
}

// TODO: take another stab at render performance, see here:
// https://tiptap.dev/docs/editor/getting-started/install/react#optimize-your-performance
export const EditorSection = memo(function EditorSection({
  sectionName,
  provider,
  aiAppId,
  user,
  yDoc,
  isProviderSynced,
  setActiveSection,
  isPrimary,
  setPrimaryEditor,
  onPrimaryHistoryUpdate,
  onSelectionUpdate,
}: EditorSectionProps) {
  // leave for debugging
  // console.log('render EditorSection', sectionName)

  const [sectionUserLock, setSectionUserLock] = useState<LockInfo>({active: false})
  const [sectionAiEdit, setSectionAiEdit] = useState<LockInfo>({active: false})
  const [editable, setEditable] = useState(true)

  const docSettings = useMemo(() => {
    if (!isProviderSynced) return undefined
    return yDoc.getMap<DocSettings>(docSettingsKeys.mapName)
  }, [yDoc, isProviderSynced])

  useEffect(() => {
    if (!docSettings) return

    const observedKeys = [
      // document-level keys
      ...Object.values(docSettingsKeys.doc.userLock),
      ...Object.values(docSettingsKeys.doc.aiEdit),
      // section-level keys
      ...Object.values(docSettingsKeys.sections(sectionName).userLock),
      ...Object.values(docSettingsKeys.sections(sectionName).aiEdit),
    ]

    const updateLockStates = () => {
      setSectionUserLock(getLockInfo(docSettings, LockType.UserLock, sectionName))
      setSectionAiEdit(getLockInfo(docSettings, LockType.AiEdit, sectionName))
      setEditable(isEditable(docSettings, sectionName))
    }

    updateLockStates()

    function onDocSettingsUpdate(event: Y.YMapEvent<DocSettings>) {
      const hasRelevantChange = Array.from(event.keysChanged).some(key =>
        observedKeys.includes(key),
      )

      if (hasRelevantChange) updateLockStates()
    }

    docSettings.observe(onDocSettingsUpdate)

    return () => {
      docSettings.unobserve(onDocSettingsUpdate)
    }
  }, [docSettings, sectionName, user.id])

  const subFragment = useMemo(() => {
    if (!isProviderSynced) return null
    return getOrCreateSubXmlFragment(yDoc, sectionName)
  }, [sectionName, yDoc, isProviderSynced])

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          history: false,
        }),
        Ai.configure({
          appId: aiAppId,
          token: user.aiToken,
          // does not appear to be working, therefore disabled
          autocompletion: false,
        }),
        AiChanges.configure({
          // optional according to the documentation but that's a lie
          getCustomDecorations({getDefaultDecorations}) {
            return getDefaultDecorations()
          },
        }),
        ...(subFragment
          ? [
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
                onUpdate: data => {
                  if (isPrimary) onPrimaryHistoryUpdate(data)
                },
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
    if (isPrimary) setPrimaryEditor(editor)
  }, [editor, isPrimary, setPrimaryEditor])

  // update editor editable state when it changes
  useEffect(() => {
    if (editor) {
      console.log(`Setting editable for ${sectionName}:`, editable, 'current:', editor.isEditable)
      editor.setEditable(editable)
    }
  }, [editor, editable, sectionName])

  return (
    editor && (
      <>
        {/* SECTION STATUS */}
        {(sectionUserLock.active || sectionAiEdit.active) && (
          <div
            className={cn(
              'mb-2 rounded p-2',
              sectionUserLock.active ? 'bg-yellow-50' : 'bg-blue-50',
            )}>
            <p className="text-sm">
              {sectionUserLock.active ? '🔒 Section locked' : '🤖 AI editing section'} by{' '}
              <span className="font-semibold">
                {sectionUserLock.active ? sectionUserLock.userName : sectionAiEdit.userName}
              </span>
            </p>
          </div>
        )}

        {/* SECTION CONTROLS */}
        <div className="mb-2 flex gap-2">
          <Button
            size="sm"
            variant={sectionUserLock.active ? 'destructive' : 'outline'}
            disabled={
              !docSettings ||
              (!sectionUserLock.active &&
                !canActivateLock(docSettings, LockType.UserLock, sectionName))
            }
            onClick={() => {
              if (!docSettings) return
              setLockInfo(
                docSettings,
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
            size="sm"
            variant={sectionAiEdit.active ? 'destructive' : 'outline'}
            disabled={
              !docSettings ||
              (!sectionAiEdit.active && !canActivateLock(docSettings, LockType.AiEdit, sectionName))
            }
            onClick={() => {
              if (!docSettings) return
              setLockInfo(
                docSettings,
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
        </div>

        {/* AI TRACKING CONTROLS */}
        <div className="flex gap-4">
          <Button onClick={() => editor.commands.startTrackingAiChanges()}>Start tracking</Button>
          <Button onClick={() => editor.commands.acceptAllAiChanges()}>Accept all</Button>
          <Button onClick={() => editor.commands.rejectAllAiChanges()}>Reject all</Button>
          <Button onClick={() => editor.commands.stopTrackingAiChanges()}>Stop tracking</Button>

          <Button
            onClick={() =>
              editor
                .chain()
                .focus()
                // startsInline helps with fixing TipTap collaboration-related issues
                .aiShorten({stream: true, format: 'rich-text', startsInline: true})
                .run()
            }>
            Shorten
          </Button>

          <Button
            onClick={() =>
              editor
                .chain()
                .focus()
                // startsInline helps with fixing TipTap collaboration-related issues
                .aiComplete({append: true, stream: true, format: 'rich-text', startsInline: true})
                .run()
            }>
            Continue
          </Button>
        </div>

        <EditorContent
          editor={editor}
          className={cn('editor-section', !editable && 'cursor-not-allowed opacity-60')}
        />
      </>
    )
  )
})
