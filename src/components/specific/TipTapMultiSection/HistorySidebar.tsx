'use client'

import {memo, useEffect, useState} from 'react'

import {CollabHistoryVersion} from '@tiptap-pro/extension-collaboration-history'
import {Editor} from '@tiptap/core'
import * as Y from 'yjs'

import {Button} from '@/components/ui/button'

interface HistorySidebarProps {
  yDoc: Y.Doc
  primaryEditor: Editor | null
}

export const HistorySidebar = memo(function HistorySidebar({
  yDoc,
  primaryEditor,
}: HistorySidebarProps) {
  const [versions, setVersions] = useState<CollabHistoryVersion[]>([])
  const [currentVersion, setCurrentVersion] = useState<number | undefined>()
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    const onUpdate = () => {
      setHasChanges(true)
    }

    yDoc.on('update', onUpdate)

    return () => {
      yDoc.off('update', onUpdate)
    }
  }, [yDoc])

  useEffect(() => {
    // keys defined by the tiptap collaboration history extension
    const tiptapConfig = yDoc.getMap('__tiptapcollab__config')
    const tiptapVersions = yDoc.getArray<CollabHistoryVersion>('__tiptapcollab__versions')

    function updateHistoryData() {
      // extract current version
      const currentVer = tiptapConfig.get('currentVersion') as number | undefined
      setCurrentVersion(currentVer)

      // get versions directly from array and sort by version number (descending)
      const versionsList = tiptapVersions.toArray()
      versionsList.sort((a, b) => b.version - a.version)
      setVersions(versionsList)
    }

    // initial update
    updateHistoryData()

    // observe changes
    tiptapConfig.observe(updateHistoryData)
    tiptapVersions.observe(updateHistoryData)

    return () => {
      tiptapConfig.unobserve(updateHistoryData)
      tiptapVersions.unobserve(updateHistoryData)
    }
  }, [yDoc])

  return (
    <div className="flex w-80 shrink-0 flex-col gap-4 overflow-scroll border-l bg-slate-50 p-4">
      <Button
        disabled={!hasChanges || !primaryEditor}
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
            disabled={!primaryEditor}
            // TODO: there current is an issue with reverting - it happens on
            // the server but does not appear in the editor until a refresh.
            // needs to be investigated (but not a priority)
            onClick={() => {
              if (!primaryEditor) return
              primaryEditor.commands.revertToVersion(version.version)
            }}>
            Revert
          </Button>
        </div>
      ))}
    </div>
  )
})
