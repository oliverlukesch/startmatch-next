'use client'

import {memo, useEffect, useMemo} from 'react'

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

import {getOrCreateSubXmlFragment} from './utils'

export interface EditorFieldProps {
  fieldName: string
  provider: TiptapCollabProvider
  aiAppId: string
  user: {
    name: string
    color: string
    docToken: string
    aiToken: string
  }
  yDoc: Y.Doc
  isProviderSynced: boolean
  setActiveField: (params: {name: string; editor: Editor | null}) => void
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
export const EditorField = memo(function EditorField({
  fieldName,
  provider,
  aiAppId,
  user,
  yDoc,
  isProviderSynced,
  setActiveField,
  isPrimary,
  setPrimaryEditor,
  onPrimaryHistoryUpdate,
  onSelectionUpdate,
}: EditorFieldProps) {
  // leave for debugging
  console.log('render EditorField', fieldName)

  const subFragment = useMemo(() => {
    if (!isProviderSynced) return null
    return getOrCreateSubXmlFragment(yDoc, fieldName)
  }, [fieldName, yDoc, isProviderSynced])

  const editor = useEditor(
    {
      // editable: false,
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
        setActiveField({name: fieldName, editor})
      },
      onSelectionUpdate,
    },
    [fieldName, provider, user, subFragment],
  )

  useEffect(() => {
    if (isPrimary) setPrimaryEditor(editor)
  }, [editor, isPrimary, setPrimaryEditor])

  return (
    editor && (
      <>
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

        <EditorContent editor={editor} className="editor-field" />
      </>
    )
  )
})
