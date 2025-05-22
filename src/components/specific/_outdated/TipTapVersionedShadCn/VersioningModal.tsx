'use client'

import {memo, useCallback, useEffect, useMemo, useState} from 'react'

import {TiptapCollabProvider} from '@hocuspocus/provider'
import {watchPreviewContent} from '@tiptap-pro/extension-collaboration-history'
import {EditorContent, useEditor} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

import {Button} from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {ScrollArea} from '@/components/ui/scroll-area'

import {VersionItem} from './VersionItem'

interface Version {
  version: number
  name?: string
  date: string | number | Date
}

interface VersioningModalProps {
  versions: Version[]
  isOpen: boolean
  onClose: () => void
  onRevert: (version: number, versionData: Version) => void
  provider: TiptapCollabProvider
  currentVersion: number | null
  latestVersion: number | null
}

const getVersionName = (version: Version): string => {
  if (version.name) {
    return version.name
  }

  if (version.version === 0) {
    return 'Initial version'
  }

  return `Version ${version.version}`
}

export const VersioningModal = memo(
  ({versions, isOpen, onClose, onRevert, provider}: VersioningModalProps) => {
    const [currentVersionId, setCurrentVersionId] = useState<number | null>(null)
    const isCurrentVersion =
      versions && versions.length > 0 ? currentVersionId === versions.at(-1)?.version : false

    const editor = useEditor({
      editable: false,
      content: '',
      extensions: [StarterKit],
    })

    const reversedVersions = useMemo(() => versions.slice().reverse(), [versions])

    const handleVersionChange = useCallback(
      (newVersion: number) => {
        setCurrentVersionId(newVersion)

        provider.sendStateless(
          JSON.stringify({
            action: 'version.preview',
            version: newVersion,
          }),
        )
      },
      [provider],
    )

    const versionData = useMemo(() => {
      if (!versions.length) {
        return null
      }

      return versions.find(v => v.version === currentVersionId)
    }, [currentVersionId, versions])

    useEffect(() => {
      if (isOpen && currentVersionId === null && versions.length > 0) {
        const initialVersion = versions.at(-1)?.version

        if (initialVersion !== undefined) {
          setCurrentVersionId(initialVersion)

          provider.sendStateless(
            JSON.stringify({
              action: 'version.preview',
              version: initialVersion,
            }),
          )
        }
      }
    }, [currentVersionId, versions, isOpen, provider])

    useEffect(() => {
      if (isOpen) {
        const unbindContentWatcher = watchPreviewContent(provider, content => {
          if (editor) {
            editor.commands.setContent(content)
          }
        })

        return () => {
          unbindContentWatcher()
        }
      }
    }, [isOpen, provider, editor])

    const handleClose = useCallback(() => {
      onClose()
      setCurrentVersionId(null)
      editor?.commands.clearContent()
    }, [onClose, editor])

    const handleRevert = useCallback(() => {
      const accepted = confirm(
        'Are you sure you want to revert to this version? Any changes not versioned will be lost.',
      )

      if (accepted && versionData && currentVersionId !== null) {
        onRevert(currentVersionId, versionData)
        onClose()
      }
    }, [onRevert, currentVersionId, versionData, onClose])

    return (
      <Dialog open={isOpen} onOpenChange={open => !open && handleClose()}>
        <DialogContent className="h-[80vh] max-w-5xl">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 gap-4">
            <div className="flex-1 overflow-hidden rounded-lg border">
              <EditorContent editor={editor} className="h-full" />
            </div>

            <div className="flex w-80 flex-col">
              <div className="mb-2 text-sm font-medium">{reversedVersions.length} versions</div>
              <ScrollArea className="flex-1 rounded-lg border">
                <div className="flex flex-col gap-2 p-4">
                  {reversedVersions.map(v => (
                    <VersionItem
                      date={v.date}
                      title={getVersionName(v)}
                      onClick={() => handleVersionChange(v.version)}
                      isActive={currentVersionId === v.version}
                      key={`version_item_${v.version}`}
                    />
                  ))}
                </div>
              </ScrollArea>

              <DialogFooter className="mt-4 gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Close
                </Button>
                <Button onClick={handleRevert} disabled={!versionData || isCurrentVersion}>
                  Restore
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  },
)

VersioningModal.displayName = 'VersioningModal'
