'use client'

import {useEffect, useMemo, useState} from 'react'

import {TiptapCollabProvider} from '@hocuspocus/provider'
import {Editor, EditorEvents} from '@tiptap/core'
import * as Y from 'yjs'

import {Button} from '@/components/ui/button'

import {cn} from '@/lib/utils'

import {EditorBubbleMenu} from './EditorBubbleMenu'
import {EditorSection} from './EditorSection'
import {EditorToolbar} from './EditorToolbar'
import {HistorySidebar} from './HistorySidebar'
import {canActivateLock, getLockInfo, setLockInfo} from './helpers/docConfigHelpers'
import './style.css'
import {DocConfig, LockInfo, LockType, docConfigKeys} from './types'

export interface EditorProps {
  docAppId: string
  aiAppId: string
  document: {
    name: string
    sections: string[]
  }
  user: {
    id: string
    name: string
    color: string
    docToken: string
    aiToken: string
  }
  className?: string
}

export default function CollabEditor({document, user, docAppId, aiAppId, className}: EditorProps) {
  // leave for debugging
  // console.log('render CollabEditor')

  // document / YJS related actions triggered through the primary editor also
  // apply to the other editors (e.g. create version, revert version, etc.)
  const [primaryEditor, setPrimaryEditor] = useState<Editor | null>(null)
  const [activeSection, setActiveSection] = useState<{name: string; editor: Editor | null} | null>(
    null,
  )
  const [selection, onSelectionUpdate] = useState<EditorEvents['selectionUpdate'] | null>(null)

  const [isProviderSynced, setIsProviderSynced] = useState(false)
  const [docUserLock, setDocUserLock] = useState<LockInfo>({active: false})
  const [docAiEdit, setDocAiEdit] = useState<LockInfo>({active: false})

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

  const docConfig = useMemo(() => {
    if (!isProviderSynced) return undefined
    return yDoc.getMap<DocConfig>(docConfigKeys.mapName)
  }, [yDoc, isProviderSynced])

  // watch doc
  useEffect(() => {
    const onSynced = () => {
      // console.log('Provider synced')
      setIsProviderSynced(true)
    }

    provider.on('synced', onSynced)

    return () => {
      provider.off('synced', onSynced)
    }
  }, [provider])

  // watch doc config
  useEffect(() => {
    if (!docConfig) return

    const observedKeys = [
      ...Object.values(docConfigKeys.doc.userLock),
      ...Object.values(docConfigKeys.doc.aiEdit),
    ]

    function updateLockStates() {
      setDocUserLock(getLockInfo(docConfig!, LockType.UserLock))
      setDocAiEdit(getLockInfo(docConfig!, LockType.AiEdit))
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
  }, [docConfig])

  return (
    <>
      <div className={cn('flex overflow-hidden rounded-xl border', className)}>
        {/* EDITOR SECTIONS */}
        <div className="flex flex-1 flex-col">
          {/* passing the editor through the selection ensures that the correct buttons are highlighted */}
          <EditorToolbar editor={selection?.editor || null} />

          {/* DOCUMENT CONTROLS AND STATUS */}
          <div className="border-b">
            {/* status display */}
            {(docUserLock.active || docAiEdit.active) && (
              <div className={cn('p-4', docUserLock.active ? 'bg-yellow-50' : 'bg-blue-50')}>
                <p className="text-sm font-medium">
                  {docUserLock.active ? '🔒 Document locked' : '🤖 AI editing document'} by{' '}
                  <span className="font-semibold">
                    {docUserLock.active ? docUserLock.userName : docAiEdit.userName}
                  </span>
                  {' at '}
                  {new Date(
                    docUserLock.active ? docUserLock.timestamp! : docAiEdit.timestamp!,
                  ).toLocaleTimeString()}
                </p>
              </div>
            )}

            {/* controls */}
            <div className="flex gap-4 p-4">
              <Button onClick={() => console.log(yDoc.toJSON())}>Log doc</Button>
              <Button
                variant={docUserLock.active ? 'destructive' : 'outline'}
                disabled={
                  !docConfig ||
                  (!docUserLock.active && !canActivateLock(docConfig, LockType.UserLock))
                }
                onClick={() => {
                  if (!docConfig) return
                  setLockInfo(docConfig, LockType.UserLock, !docUserLock.active, {
                    userId: user.id,
                    name: user.name,
                  })
                }}>
                {docUserLock.active ? 'Unlock Document' : 'Lock Document'}
              </Button>
              <Button
                variant={docAiEdit.active ? 'destructive' : 'outline'}
                disabled={
                  !docConfig || (!docAiEdit.active && !canActivateLock(docConfig, LockType.AiEdit))
                }
                onClick={() => {
                  if (!docConfig) return
                  setLockInfo(docConfig, LockType.AiEdit, !docAiEdit.active, {
                    userId: user.id,
                    name: user.name,
                  })
                }}>
                {docAiEdit.active ? 'Stop AI Edit' : 'Start AI Edit'}
              </Button>
            </div>
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
              Active Section:{' '}
              <span className="font-semibold text-foreground uppercase">
                {activeSection?.name || 'None'}
              </span>
            </span>
          </div>
        </div>

        <HistorySidebar yDoc={yDoc} primaryEditor={primaryEditor} />
      </div>

      {selection?.editor && <EditorBubbleMenu editor={selection.editor} />}
    </>
  )
}
