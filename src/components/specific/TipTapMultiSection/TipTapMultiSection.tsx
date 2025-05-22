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

import {EditorSection} from './EditorSection'
import {EditorToolbar} from './EditorToolbar'
import './style.css'
import {safeYjsMapGet, safeYjsMapSet} from './utils'

export interface EditorProps {
  docAppId: string
  aiAppId: string
  document: {
    name: string
    sections: string[]
  }
  user: {
    name: string
    color: string
    docToken: string
    aiToken: string
  }
  className?: string
}

interface DocSettings {
  isAiEditing: boolean
}

const docSettingsKeys = {
  mapName: '__sm__settings',
  isAiEditing: 'isAiEditing',
}

export default function CollabEditor({document, user, docAppId, aiAppId, className}: EditorProps) {
  // leave for debugging
  console.log('render CollabEditor')

  // document / YJS related actions triggered through the primary editor also
  // apply to the other editors (e.g. create version, revert version, etc.)
  const [primaryEditor, setPrimaryEditor] = useState<Editor | null>(null)
  const [activeSection, setActiveSection] = useState<{name: string; editor: Editor | null} | null>(
    null,
  )
  const [selection, onSelectionUpdate] = useState<EditorEvents['selectionUpdate'] | null>(null)

  const [isProviderSynced, setIsProviderSynced] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [isAiEditing, setIsAiEditing] = useState(false)

  const [versions, setVersions] = useState<CollabHistoryVersion[]>([])
  const [currentVersion, setCurrentVersion] = useState<number | undefined>()

  const [yDoc, provider] = useMemo(() => {
    const yDoc = new Y.Doc()

    const provider = new TiptapCollabProvider({
      appId: docAppId,
      name: document.name,
      token: user.docToken,
      document: yDoc,
    })

    return [yDoc, provider]
  }, [document, user, docAppId])

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

  const docSettings = useMemo(() => {
    if (!isProviderSynced) return

    const docSettings = yDoc.getMap<DocSettings>(docSettingsKeys.mapName)

    const isAiEditing = safeYjsMapGet<boolean>(docSettings, docSettingsKeys.isAiEditing)
    setIsAiEditing(isAiEditing)

    docSettings.observe(() => {
      const isAiEditing = safeYjsMapGet<boolean>(docSettings, docSettingsKeys.isAiEditing)
      setIsAiEditing(isAiEditing)
    })

    return docSettings
  }, [yDoc, isProviderSynced])

  return (
    <div className={cn('flex overflow-hidden rounded-xl border', className)}>
      {/* EDITOR SECTIONS */}
      <div className="flex flex-1 flex-col">
        {/* passing the editor through the selection ensures that the correct buttons are highlighted */}
        <EditorToolbar editor={selection?.editor || null} />

        <div className={cn('flex gap-4 border-b p-4', isAiEditing && 'bg-red-50')}>
          <Button onClick={() => console.log(yDoc.toJSON())}>Log doc</Button>
          <Button
            className={cn(isAiEditing && 'bg-destructive')}
            onClick={() =>
              docSettings && safeYjsMapSet(docSettings, docSettingsKeys.isAiEditing, !isAiEditing)
            }>
            Is AI editing: {JSON.stringify(isAiEditing)}
          </Button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-scroll p-4">
          {isProviderSynced &&
            document.sections.map((sectionName, index) => (
              <div className="flex flex-col gap-2" key={sectionName}>
                <h4 className="text-md font-semibold text-muted-foreground uppercase">
                  {sectionName}
                </h4>
                <EditorSection
                  sectionName={sectionName}
                  provider={provider}
                  aiAppId={aiAppId}
                  user={user}
                  yDoc={yDoc}
                  isProviderSynced={isProviderSynced}
                  setActiveSection={setActiveSection}
                  isPrimary={index === 0}
                  setPrimaryEditor={setPrimaryEditor}
                  onPrimaryHistoryUpdate={onPrimaryHistoryUpdate}
                  onSelectionUpdate={onSelectionUpdate}
                />
              </div>
            ))}
        </div>

        {/* TODO: extract into stand-alone + memoed component */}
        <div className="flex shrink-0 gap-4 border-t px-4 py-2">
          <span className="text-muted-foreground">
            Current User: <span className="font-semibold text-foreground">{user.name}</span>
          </span>

          <span className="text-muted-foreground">
            Active Section:{' '}
            <span className="font-semibold text-foreground uppercase">
              {activeSection?.name || 'None'}
            </span>
          </span>
        </div>
      </div>

      {/* SIDEBAR */}
      {/* TODO: extract into stand-alone + memoed component */}
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
