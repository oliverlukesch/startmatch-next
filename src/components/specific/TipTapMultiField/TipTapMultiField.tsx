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

import {EditorToolbar} from './EditorToolbar'
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

// EDITOR FIELD COMPONENT

function getOrCreateSubFragment(doc: Y.Doc, subFieldName: string): Y.XmlFragment {
  const defaultMap = doc.getMap('default')
  let subFragment = defaultMap.get(subFieldName) as Y.XmlFragment

  if (!subFragment || !(subFragment instanceof Y.XmlFragment)) {
    subFragment = new Y.XmlFragment()
    defaultMap.set(subFieldName, subFragment)
  }

  return subFragment
}

interface EditorFieldProps {
  fieldName: string
  provider: TiptapCollabProvider
  user: {name: string; color: string}
  yDoc: Y.Doc
  isProviderSynced: boolean
  setActiveField: (params: {fieldName: string; editor: Editor | null}) => void
  isPrimary: boolean
  setPrimaryEditor: (editor: Editor | null) => void
  // CollaborationHistory only works inside the editor context which is why we
  // pipe through the update event
  onPrimaryHistoryUpdate: (data: CollabOnUpdateProps) => void
}

const EditorField = ({
  fieldName,
  provider,
  user,
  yDoc,
  isProviderSynced,
  setActiveField,
  isPrimary,
  setPrimaryEditor,
  onPrimaryHistoryUpdate,
}: EditorFieldProps) => {
  const subFragment = useMemo(() => {
    if (!isProviderSynced) return null
    return getOrCreateSubFragment(yDoc, fieldName)
  }, [fieldName, yDoc, isProviderSynced])

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          history: false,
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

  // document / YJS related actions on the primary editor also apply to the
  // other editors (e.g. create version, revert version, etc.)
  const [primaryEditor, setPrimaryEditor] = useState<Editor | null>(null)
  const [activeField, setActiveField] = useState<{fieldName: string; editor: Editor | null} | null>(
    null,
  )

  const [yDoc, provider] = useMemo(() => {
    const yDoc = new Y.Doc()

    const provider = new TiptapCollabProvider({
      appId: appId,
      name: document.name,
      token: user.token,
      document: yDoc,
    })

    return [yDoc, provider]
  }, [document, user, appId])

  function onPrimaryHistoryUpdate(data: CollabOnUpdateProps) {
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
      yDoc.on('update', onUpdate)
    }

    provider.on('synced', onSynced)

    return () => {
      provider.off('synced', onSynced)
      yDoc.off('update', onUpdate)
    }
  }, [yDoc, provider])

  return (
    <div className={cn('flex overflow-hidden rounded-xl border', className)}>
      {/* EDITOR FIELDS */}
      <div className="flex flex-1 flex-col">
        <EditorToolbar editor={activeField?.editor || null} />
        <div className="flex flex-1 flex-col gap-4 overflow-scroll p-4">
          {document.fields.map((fieldName, index) => (
            <div className="flex flex-col gap-2" key={fieldName}>
              <h4 className="text-md font-semibold text-muted-foreground uppercase">{fieldName}</h4>
              <EditorField
                fieldName={fieldName}
                provider={provider}
                user={user}
                yDoc={yDoc}
                isProviderSynced={isProviderSynced}
                setActiveField={setActiveField}
                isPrimary={index === 0}
                setPrimaryEditor={setPrimaryEditor}
                onPrimaryHistoryUpdate={onPrimaryHistoryUpdate}
              />
            </div>
          ))}
        </div>

        <div className="flex shrink-0 gap-4 border-t px-4 py-2">
          <span className="text-muted-foreground">
            Current User: <span className="font-semibold text-foreground">{user.name}</span>
          </span>

          <span className="text-muted-foreground">
            Active Field:{' '}
            <span className="font-semibold text-foreground uppercase">
              {activeField?.fieldName || 'None'}
            </span>
          </span>
        </div>
      </div>

      {/* SIDEBAR */}
      <div className="flex w-80 shrink-0 flex-col gap-4 overflow-scroll border-l bg-slate-50 p-4">
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

        {currentVersion && (
          <div className="text-center text-lg text-muted-foreground">
            Current version: <span className="font-semibold text-foreground">{currentVersion}</span>
          </div>
        )}

        {versions.map(version => (
          <div key={version.version} className="flex items-center justify-between gap-2">
            {version.version}: {version.name}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!primaryEditor) return
                primaryEditor.commands.revertToVersion(version.version)
              }}>
              Revert
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
