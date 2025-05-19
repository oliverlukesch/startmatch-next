'use client'

import {useEffect, useMemo, useState} from 'react'

import {TiptapCollabProvider} from '@hocuspocus/provider'
import CollaborationHistory, {
  CollabHistoryVersion,
  CollabOnUpdateProps,
} from '@tiptap-pro/extension-collaboration-history'
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
  isPrimary: boolean
  setPrimaryEditor: (editor: Editor | null) => void
  onPrimaryHistoryUpdate: (data: CollabOnUpdateProps) => void
}

const EditorField = ({
  fieldName,
  provider,
  user,
  doc,
  isProviderSynced,
  setActiveField,
  isPrimary,
  setPrimaryEditor,
  onPrimaryHistoryUpdate,
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
                onUpdate: data => {
                  if (isPrimary) onPrimaryHistoryUpdate(data)
                },
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
    if (isPrimary) setPrimaryEditor(editor)
  }, [editor, isPrimary, setPrimaryEditor])

  return <EditorContent editor={editor} className="editor-field" />
}

// MAIN COMPONENT

export default function CollabEditor({document, user, appId, className}: EditorProps) {
  const [isProviderSynced, setIsProviderSynced] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const [versions, setVersions] = useState<CollabHistoryVersion[]>([])
  const [currentVersion, setCurrentVersion] = useState<number | undefined>()

  const [primaryEditor, setPrimaryEditor] = useState<Editor | null>(null)
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

  function onPrimaryHistoryUpdate(data: CollabOnUpdateProps) {
    console.log('History update:', data)
    setVersions(data.versions)
    setCurrentVersion(data.currentVersion)
  }

  useEffect(() => {
    const onUpdate = () => {
      console.log('Document updated')
      setHasChanges(true)
    }

    const onSynced = () => {
      console.log('Provider synced')
      setIsProviderSynced(true)
      doc.on('update', onUpdate)
    }

    provider.on('synced', onSynced)

    CollaborationHistory.configure({
      provider,
      onUpdate: data => {
        console.log('History update:', data)
      },
    })

    return () => {
      provider.off('synced', onSynced)
      doc.off('update', onUpdate)
    }
  }, [provider])

  return (
    <div className={cn('flex flex-1 flex-col gap-3', className)}>
      {activeField && <h2 className="text-xl font-semibold">Active: {activeField?.fieldName}</h2>}

      <div className="flex justify-between gap-6 rounded-xl border p-2">
        <div className="flex flex-col gap-3">
          <Button
            onClick={() => {
              console.log(
                provider.configuration.document.share.forEach((item, key) => {
                  console.log(key, item.toJSON())
                }),
              )
            }}>
            Log document
          </Button>

          <Button
            disabled={!hasChanges}
            onClick={() => {
              if (!primaryEditor) return
              primaryEditor.commands.saveVersion(`version-${Date.now()}`)
              setHasChanges(false)
            }}>
            Save version
          </Button>
        </div>

        <ul className="list-disc pl-5">
          {versions.map(version => (
            <li key={version.version} className="flex items-center justify-between gap-2">
              <span>
                {version.version}: {version.name}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!primaryEditor) return
                  primaryEditor.commands.revertToVersion(version.version)
                }}>
                Revert
              </Button>
            </li>
          ))}
        </ul>

        {currentVersion && (
          <div>
            Current version: {currentVersion} - {new Date(currentVersion).toLocaleString()}
          </div>
        )}
      </div>

      {document.fields.map((fieldName, index) => (
        <div key={fieldName}>
          <h3 className="text-lg font-semibold">{fieldName}</h3>
          <EditorField
            fieldName={fieldName}
            provider={provider}
            user={user}
            doc={doc}
            isProviderSynced={isProviderSynced}
            setActiveField={setActiveField}
            isPrimary={index === 0}
            setPrimaryEditor={setPrimaryEditor}
            onPrimaryHistoryUpdate={onPrimaryHistoryUpdate}
          />
        </div>
      ))}
    </div>
  )
}
