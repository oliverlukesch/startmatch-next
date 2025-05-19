'use client'

import {useCallback, useEffect, useMemo, useState} from 'react'

import {TiptapCollabProvider} from '@hocuspocus/provider'
import CollaborationHistory from '@tiptap-pro/extension-collaboration-history'
import {Collaboration} from '@tiptap/extension-collaboration'
import {CollaborationCursor} from '@tiptap/extension-collaboration-cursor'
import {Editor, EditorContent, useEditor} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import * as Y from 'yjs'

import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {RadioGroup, RadioGroupItem} from '@/components/ui/radio-group'
import {Separator} from '@/components/ui/separator'

import {VersioningModal} from './VersioningModal'
import './style.css'
import {renderDate} from './utils'

export type EditorProps = {
  appId: string
  documentName: string
  user: {
    name: string
    color: string
    token: string
  }
  className?: string
}
interface Version {
  version: number
  name?: string
  date: string | number | Date
}

interface MenuBarProps {
  editor: Editor | null
}

const MenuBar = ({editor}: MenuBarProps) => {
  if (!editor) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-2 border-b p-2">
      <Button
        variant={editor.isActive('bold') ? 'secondary' : 'outline'}
        size="sm"
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}>
        Bold
      </Button>
      <Button
        variant={editor.isActive('italic') ? 'secondary' : 'outline'}
        size="sm"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}>
        Italic
      </Button>
      <Button
        variant={editor.isActive('code') ? 'secondary' : 'outline'}
        size="sm"
        onClick={() => editor.chain().focus().toggleCode().run()}
        disabled={!editor.can().chain().focus().toggleCode().run()}>
        Code
      </Button>
      <Button
        variant={editor.isActive('heading', {level: 1}) ? 'secondary' : 'outline'}
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({level: 1}).run()}>
        H1
      </Button>
      <Button
        variant={editor.isActive('heading', {level: 2}) ? 'secondary' : 'outline'}
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({level: 2}).run()}>
        H2
      </Button>
      <Button
        variant={editor.isActive('heading', {level: 3}) ? 'secondary' : 'outline'}
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({level: 3}).run()}>
        H3
      </Button>
      <Button
        variant={editor.isActive('bulletList') ? 'secondary' : 'outline'}
        size="sm"
        onClick={() => editor.chain().focus().toggleBulletList().run()}>
        Bullet list
      </Button>
      <Button
        variant={editor.isActive('codeBlock') ? 'secondary' : 'outline'}
        size="sm"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        Code block
      </Button>
      <Button
        variant={editor.isActive('blockquote') ? 'secondary' : 'outline'}
        size="sm"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        Blockquote
      </Button>
    </div>
  )
}

function getOrCreateSubField(doc: Y.Doc, subFieldName: string): Y.XmlFragment {
  // Check if the doc has a top-level field named "default"
  let defaultField = doc.get('default')

  // Check if the field exists and is of type map
  if (!defaultField || !(defaultField instanceof Y.Map)) {
    console.log('Creating new default field')
    // Create the top-level field named "default" as a map
    defaultField = doc.getMap('default')
  }

  // Ensure we're working with a Y.Map
  const defaultMap = defaultField as Y.Map<unknown>

  // Check if the map has an XML fragment with the name of the sub-field
  let subField = defaultMap.get(subFieldName)

  // If the sub-field doesn't exist or isn't an XML fragment, create it
  if (!subField || !(subField instanceof Y.XmlFragment)) {
    console.log('Creating new sub-field:', subFieldName)
    subField = new Y.XmlFragment()
    defaultMap.set(subFieldName, subField)
  }

  return subField as Y.XmlFragment
}

export const CollabEditor = ({documentName, user, appId}: EditorProps) => {
  const [latestVersion, setLatestVersion] = useState<number | null>(null)
  const [currentVersion, setCurrentVersion] = useState<number | null>(null)
  const [versions, setVersions] = useState<Version[]>([])
  const [isAutoVersioning, setIsAutoVersioning] = useState(false)
  const [versioningModalOpen, setVersioningModalOpen] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [commitDescription, setCommitDescription] = useState('')
  const [synced, setSynced] = useState(false)

  const showVersioningModal = useCallback(() => {
    setVersioningModalOpen(true)
  }, [])

  const [yDoc, provider] = useMemo(() => {
    const yDoc = new Y.Doc()

    const provider = new TiptapCollabProvider({
      appId: appId,
      name: documentName,
      token: user.token,
      document: yDoc,
    })

    return [yDoc, provider]
  }, [documentName, user, appId])

  const childFragment = useMemo(() => {
    if (!synced) return null
    return getOrCreateSubField(yDoc, 'custom-2')
  }, [synced, yDoc])

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          history: false,
        }),
        ...(childFragment
          ? [
              Collaboration.configure({
                document: yDoc,
                fragment: childFragment,
              }),
              CollaborationCursor.configure({
                provider,
                user,
              }),
              CollaborationHistory.configure({
                provider,
                onUpdate: data => {
                  setVersions(data.versions)
                  setIsAutoVersioning(data.versioningEnabled)
                  setLatestVersion(data.version)
                  setCurrentVersion(data.currentVersion)
                },
              }),
            ]
          : []),
      ],
    },
    [provider, user, childFragment, yDoc],
  )

  useEffect(() => {
    const onUpdate = () => {
      setHasChanges(true)
    }

    const onSynced = () => {
      console.log('Synced')
      setSynced(true)
      yDoc.on('update', onUpdate)
    }

    provider.on('synced', onSynced)

    return () => {
      provider.off('synced', onSynced)
      yDoc.off('update', onUpdate)
    }
  }, [provider, yDoc])

  const handleCommitDescriptionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCommitDescription(event.target.value)
  }

  const handleNewVersion = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!commitDescription || !editor) {
        return
      }
      editor.commands.saveVersion(commitDescription)
      setCommitDescription('')
      alert(`Version ${commitDescription} created! Open the version history to see all versions.`)
      setHasChanges(false)
    },
    [editor, commitDescription],
  )

  const handleVersioningClose = useCallback(() => {
    setVersioningModalOpen(false)
  }, [])

  const handleRevert = useCallback(
    (version: number, versionData: Version) => {
      if (!editor) return
      const versionTitle = versionData ? versionData.name || renderDate(versionData.date) : version

      editor.commands.revertToVersion(
        version,
        `Revert to ${versionTitle}`,
        `Unsaved changes before revert to ${versionTitle}`,
      )
    },
    [editor],
  )

  if (!editor) {
    return null
  }

  return (
    <>
      <VersioningModal
        versions={versions}
        isOpen={versioningModalOpen}
        onClose={handleVersioningClose}
        onRevert={handleRevert}
        currentVersion={currentVersion}
        latestVersion={latestVersion}
        provider={provider}
      />
      <div className="flex flex-row gap-4">
        <div className="flex-1">
          <MenuBar editor={editor} />
          <Button
            onClick={() => {
              console.log(provider.configuration.document.share)
              console.log(provider.configuration.document.toJSON())
              // console.log('isAutoVersioning', provider.isAutoVersioning())
              // console.log('versions', provider.getVersions())
              // console.log(editor.storage.collabHistory)
            }}>
            Log Provider and collabHistory
          </Button>
          <EditorContent editor={editor} className="p-4" />
        </div>
        <Card className="w-80 shrink-0">
          <CardContent className="flex flex-col gap-6">
            <div>
              <CardHeader className="px-0 py-0">
                <CardTitle>Auto versioning</CardTitle>
              </CardHeader>
              <RadioGroup
                value={isAutoVersioning ? 'enable' : 'disable'}
                onValueChange={value => {
                  if (value === 'enable' && !isAutoVersioning) editor.commands.toggleVersioning()
                  if (value === 'disable' && isAutoVersioning) editor.commands.toggleVersioning()
                }}
                className="mt-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="enable" id="auto-versioning-enable" />
                  <Label htmlFor="auto-versioning-enable">Enable</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="disable" id="auto-versioning-disable" />
                  <Label htmlFor="auto-versioning-disable">Disable</Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            <div>
              <CardHeader className="px-0 py-0">
                <CardTitle>Manual versioning</CardTitle>
              </CardHeader>
              <p className="mt-2 text-sm text-muted-foreground">
                Make adjustments to the document to manually save a new version.
              </p>
              <form onSubmit={handleNewVersion} className="mt-4 flex flex-col gap-4">
                <Input
                  disabled={!hasChanges}
                  type="text"
                  placeholder="Version name"
                  value={commitDescription}
                  onChange={handleCommitDescriptionChange}
                />
                <Button type="submit" disabled={!hasChanges || commitDescription.length === 0}>
                  Create
                </Button>
              </form>
            </div>

            <Separator />

            <Button variant="outline" onClick={showVersioningModal} className="w-full">
              Show history
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
