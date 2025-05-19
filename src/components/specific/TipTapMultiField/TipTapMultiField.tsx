'use client'

import {useEffect, useMemo, useRef, useState} from 'react'

import {TiptapCollabProvider} from '@hocuspocus/provider'
import CollaborationHistory from '@tiptap-pro/extension-collaboration-history'
import {Editor} from '@tiptap/core'
import {Collaboration} from '@tiptap/extension-collaboration'
import {CollaborationCursor} from '@tiptap/extension-collaboration-cursor'
import {EditorContent, useEditor} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import * as Y from 'yjs'

import {Button} from '@/components/ui/button'

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

function getOrCreateSubField(doc: Y.Doc, subFieldName: string): Y.XmlFragment {
  let defaultField = doc.get('default')

  if (!defaultField || !(defaultField instanceof Y.Map)) {
    defaultField = doc.getMap('default')
  }

  const defaultMap = defaultField as Y.Map<unknown>

  let subField = defaultMap.get(subFieldName) as Y.XmlFragment

  if (!subField || !(subField instanceof Y.XmlFragment)) {
    subField = new Y.XmlFragment()
    defaultMap.set(subFieldName, subField)
  }

  return subField
}

interface EditorFieldProps {
  fieldName: string
  provider: TiptapCollabProvider
  user: {name: string; color: string}
  doc: Y.Doc
  isProviderSynced: boolean
  setActiveField: (params: {fieldName: string; editor: Editor | null}) => void
  editorMap: Map<string, Editor>
}

const EditorField = ({
  fieldName,
  provider,
  user,
  doc,
  isProviderSynced,
  setActiveField,
  editorMap,
}: EditorFieldProps) => {
  const subFragment = useMemo(() => {
    if (!isProviderSynced) return null
    return getOrCreateSubField(doc, fieldName)
  }, [fieldName, doc, isProviderSynced])

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          history: false,
        }),
        ...(subFragment
          ? [
              Collaboration.configure({
                document: doc,
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
      // default in V3, might increase performance
      shouldRerenderOnTransaction: false,
      onFocus: () => {
        setActiveField({fieldName, editor})
      },
    },
    [fieldName, provider, user, subFragment],
  )

  useEffect(() => {
    if (editor) editorMap.set(fieldName, editor)
    else editorMap.delete(fieldName)

    return () => {
      if (editor) editor.destroy()
      editorMap.delete(fieldName)
    }
  }, [fieldName, editorMap, editor])

  return <EditorContent editor={editor} className="editor-field" />
}

// MAIN COMPONENT

export default function CollabEditor({document, user, appId, className}: EditorProps) {
  const [isProviderSynced, setIsProviderSynced] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const editorMap = useRef<Map<string, Editor>>(new Map())
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

  useEffect(() => {
    const onUpdate = () => {
      setHasChanges(true)
    }

    const onSynced = () => {
      setIsProviderSynced(true)
      doc.on('update', onUpdate)
    }

    provider.on('synced', onSynced)

    return () => {
      provider.off('synced', onSynced)
      doc.off('update', onUpdate)
    }
  }, [provider])

  return (
    <div className={cn('flex flex-1 flex-col gap-3', className)}>
      {activeField && <h2 className="text-xl font-semibold">Active: {activeField?.fieldName}</h2>}

      <div className="flex gap-3">
        <Button
          onClick={() => {
            console.log(provider.configuration.document.share)
            console.log(provider.configuration.document.toJSON())
          }}>
          Log document
        </Button>

        <Button
          disabled={!hasChanges}
          onClick={() => {
            const firstEditor = editorMap.current.values().next().value
            if (!firstEditor) return

            firstEditor.commands.saveVersion(`version-${Date.now()}`)
            setHasChanges(false)

            console.log(provider.configuration.document.share)
            console.log(provider.configuration.document.toJSON())
          }}>
          Save version
        </Button>
      </div>

      {document.fields.map(fieldName => (
        <div key={fieldName}>
          <h3 className="text-lg font-semibold">{fieldName}</h3>
          <EditorField
            fieldName={fieldName}
            provider={provider}
            user={user}
            doc={doc}
            isProviderSynced={isProviderSynced}
            setActiveField={setActiveField}
            editorMap={editorMap.current}
          />
        </div>
      ))}
    </div>
  )
}
