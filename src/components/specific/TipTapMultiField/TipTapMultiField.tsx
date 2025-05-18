'use client'

import {useMemo, useState} from 'react'

import {TiptapCollabProvider} from '@hocuspocus/provider'
import {Editor} from '@tiptap/core'
import {Collaboration} from '@tiptap/extension-collaboration'
import {CollaborationCursor} from '@tiptap/extension-collaboration-cursor'
import {EditorContent, useEditor} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import * as Y from 'yjs'

import {cn} from '@/lib/utils'

import './style.css'

// TYPES AND ENUMS

export type EditorProps = {
  appId: string
  document: {
    name: string
    fields: string[]
  }
  user: {
    name: string
    color: string
    token: string
  }
  className?: string
}

// EDITOR SETUP

const doc = new Y.Doc()

// EDITOR FIELD COMPONENT

interface EditorFieldProps {
  fieldName: string
  provider: TiptapCollabProvider
  user: {name: string; color: string}
  doc: Y.Doc
  setActive: (params: {fieldName: string; editor: Editor | null}) => void
}

const EditorField = ({fieldName, provider, user, doc, setActive}: EditorFieldProps) => {
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure(),
        Collaboration.configure({
          document: doc,
          field: fieldName,
        }),
        CollaborationCursor.configure({
          provider,
          user,
        }),
      ],
      // default in V3, might increase performance
      shouldRerenderOnTransaction: false,
      onFocus: () => {
        setActive({fieldName, editor})
      },
    },
    [fieldName, provider, user],
  )

  return <EditorContent editor={editor} className="editor-field" />
}

// MAIN COMPONENT

export default function CollabEditor({document, user, appId, className}: EditorProps) {
  const [activeField, setActiveField] = useState<{fieldName: string; editor: Editor | null} | null>(
    null,
  )

  const provider = useMemo(() => {
    return new TiptapCollabProvider({
      appId: appId,
      name: document.name,
      token: user.token,
      document: doc,
    })
  }, [document, user, appId])

  return (
    <div className={cn('flex flex-1 flex-col gap-3', className)}>
      {activeField && <h2 className="text-xl font-semibold">Active: {activeField?.fieldName}</h2>}
      {document.fields.map(fieldName => (
        <>
          <h3 className="text-lg font-semibold">{fieldName}</h3>
          <EditorField
            key={fieldName}
            fieldName={fieldName}
            provider={provider}
            user={user}
            doc={doc}
            setActive={setActiveField}
          />
        </>
      ))}
    </div>
  )
}
