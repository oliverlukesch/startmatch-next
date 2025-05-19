'use client'

import {useCallback, useEffect, useMemo, useState} from 'react'

import {TiptapCollabProvider} from '@hocuspocus/provider'
import {
  CollabHistoryVersion,
  CollabOnUpdateProps,
} from '@tiptap-pro/extension-collaboration-history'
import {Editor, EditorEvents} from '@tiptap/core'
import * as Y from 'yjs'

import {Button} from '@/components/ui/button'

import {cn} from '@/lib/utils'

import {EditorField} from './EditorField'
import {EditorToolbar} from './EditorToolbar'
import './style.css'

export interface EditorProps {
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

// TODO: take another stab at render performance, see here:
// https://tiptap.dev/docs/editor/getting-started/install/react#optimize-your-performance
export default function CollabEditor({document, user, appId, className}: EditorProps) {
  // leave for debugging
  // console.log('render CollabEditor')

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
  const [selection, onSelectionUpdate] = useState<EditorEvents['selectionUpdate'] | null>(null)

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

  const onPrimaryHistoryUpdate = useCallback((data: CollabOnUpdateProps) => {
    setVersions(data.versions)
    setCurrentVersion(data.currentVersion)
  }, [])

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
        {/* passing the editor through the selection ensures that the correct buttons are highlighted */}
        <EditorToolbar editor={selection?.editor || null} />

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
                onSelectionUpdate={onSelectionUpdate}
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
      {/* TODO: decouple into stand-alone + memoed component */}
      <div className="flex w-80 shrink-0 flex-col gap-4 overflow-scroll border-l bg-slate-50 p-4">
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
