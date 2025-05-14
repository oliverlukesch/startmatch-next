'use client'

import {useEffect, useMemo, useState} from 'react'

import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  defaultStyleSpecs,
} from '@blocknote/core'
import {DefaultThreadStoreAuth, TiptapThreadStore} from '@blocknote/core/comments'
import '@blocknote/core/fonts/inter.css'
import {de as blockNoteDE} from '@blocknote/core/locales'
import {BlockNoteView} from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import {
  BlockNoteViewEditor,
  FloatingComposerController,
  ThreadsSidebar,
  useCreateBlockNote,
} from '@blocknote/react'
import {TiptapCollabProvider} from '@hocuspocus/provider'
import CollaborationHistory from '@tiptap-pro/extension-collaboration-history'
import * as Y from 'yjs'

import {Button} from '@/components/ui/button'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'

import './style.css'

// TYPES AND ENUMS

export type CollabEditorProps = {
  className?: string
  documentName: string
  appId: string
  user: {
    name: string
    color: string
    token: string
  }
}

enum CommentFilterStatus {
  Open = 'open',
  Resolved = 'resolved',
  All = 'all',
}

enum CommentSortOrder {
  Position = 'position',
  RecentActivity = 'recent-activity',
  Oldest = 'oldest',
}

enum TabContent {
  Comments = 'comments',
  History = 'history',
}

type User = {
  id: string
  username: string
  avatarUrl: string
}

// EDITOR SETUP

const doc = new Y.Doc()

const schema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    heading: defaultBlockSpecs.heading,
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    table: defaultBlockSpecs.table,
  },
  styleSpecs: {
    bold: defaultStyleSpecs.bold,
    italic: defaultStyleSpecs.italic,
    underline: defaultStyleSpecs.underline,
    strike: defaultStyleSpecs.strike,
  },
  // @ts-expect-error: link is actually not required
  inlineContentSpecs: {
    text: defaultInlineContentSpecs.text,
    // link: defaultInlineContentSpecs.link,
  },
})

async function resolveUsers(userIds: string[]): Promise<User[]> {
  await new Promise(resolve => setTimeout(resolve, 100))

  return userIds.map(userId => ({
    id: userId,
    username: userId,
    avatarUrl: `https://picsum.photos/seed/${userId}/200/300`,
  }))
}

// MAIN COMPONENT

export default function CollabEditor({documentName, user, appId, ...props}: CollabEditorProps) {
  const [sidebarTab, setSidebarTab] = useState<TabContent>(TabContent.Comments)
  const [commentFilter, setCommentFilter] = useState<CommentFilterStatus>(CommentFilterStatus.Open)
  const [commentSort, setCommentSort] = useState<CommentSortOrder>(CommentSortOrder.Position)

  const [latestVersion, setLatestVersion] = useState(null)
  const [currentVersion, setCurrentVersion] = useState(null)
  const [versions, setVersions] = useState([])
  const [isAutoVersioning, setIsAutoVersioning] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const provider = useMemo(() => {
    return new TiptapCollabProvider({
      appId: appId,
      name: documentName,
      token: user.token,
      document: doc,
    })
  }, [documentName, user, appId])

  const threadStore = useMemo(() => {
    return new TiptapThreadStore(
      user.name,
      provider,
      new DefaultThreadStoreAuth(user.name, 'editor'),
    )
  }, [user, provider])

  const editor = useCreateBlockNote(
    {
      animations: false,
      schema,
      collaboration: {
        provider,
        fragment: doc.getXmlFragment('document-store'),
        user: {
          name: user.name,
          color: user.color,
        },
        showCursorLabels: 'activity',
      },
      comments: {
        threadStore,
      },
      resolveUsers,
      dictionary: blockNoteDE,
      _tiptapOptions: {
        extensions: [
          CollaborationHistory.configure({
            provider,
            onUpdate: data => {
              // @ts-expect-error: is okay
              setVersions(data.versions)
              setIsAutoVersioning(data.versioningEnabled)
              // @ts-expect-error: is okay
              setLatestVersion(data.version)
              // @ts-expect-error: is okay
              setCurrentVersion(data.currentVersion)
            },
          }),
        ],
      },
    },
    [provider, threadStore],
  )

  useEffect(() => {
    if (!editor) return
    console.log('Editor created')

    editor._tiptapEditor.storage.collabHistory.provider = provider
    editor._tiptapEditor.storage.collabHistory.status = 'connected'
    editor._tiptapEditor.commands.toggleVersioning()

    console.log(editor._tiptapEditor.storage.collabHistory)
  }, [editor])

  useEffect(() => {
    const onUpdate = () => {
      console.log('On doc updated')
      setHasChanges(true)
    }

    const onSynced = () => {
      console.log('On doc synced')
      doc.on('update', onUpdate)
    }

    provider.on('synced', onSynced)

    return () => {
      provider.off('synced', onSynced)
      doc.off('update', onUpdate)
    }
  }, [provider])

  return (
    <BlockNoteView
      editor={editor}
      renderEditor={false}
      comments={false}
      sideMenu={false}
      data-theming-primary-rte
      {...props}>
      <div className="flex h-full flex-row">
        <div className="flex-1">
          <BlockNoteViewEditor />
          <FloatingComposerController />
        </div>

        <Tabs
          value={sidebarTab}
          onValueChange={value => setSidebarTab(value as TabContent)}
          className="max-w-80 flex-1 shrink-0 border-l bg-slate-50 p-3">
          <TabsList className="mb-2 w-full">
            <TabsTrigger value={TabContent.Comments}>Kommentare</TabsTrigger>
            <TabsTrigger value={TabContent.History}>Historie</TabsTrigger>
          </TabsList>

          <TabsContent value={TabContent.Comments}>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <Select
                value={commentFilter}
                onValueChange={value => setCommentFilter(value as CommentFilterStatus)}>
                <SelectTrigger id="comment-filter" className="w-full">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CommentFilterStatus.All}>Alle</SelectItem>
                  <SelectItem value={CommentFilterStatus.Open}>Offen</SelectItem>
                  <SelectItem value={CommentFilterStatus.Resolved}>Abgeschlossen</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={commentSort}
                onValueChange={value => setCommentSort(value as CommentSortOrder)}>
                <SelectTrigger id="comment-sort" className="w-full">
                  <SelectValue placeholder="Sortierung" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CommentSortOrder.Position}>Position</SelectItem>
                  <SelectItem value={CommentSortOrder.RecentActivity}>Aktivität</SelectItem>
                  <SelectItem value={CommentSortOrder.Oldest}>Älteste</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ThreadsSidebar filter={commentFilter} sort={commentSort} />
          </TabsContent>

          <TabsContent value={TabContent.History} className="flex flex-col gap-2">
            <Button
              onClick={() => {
                editor._tiptapEditor.commands.saveVersion(`Version ${Date.now()}`)
                console.log(editor._tiptapEditor.storage.collabHistory)
                console.log('Version saved')
              }}>
              Save version
            </Button>

            <Button
              onClick={() => {
                console.log(editor._tiptapEditor.storage.collabHistory)
                console.log('Log history')
              }}>
              Log history
            </Button>

            <Button
              onClick={() => {
                editor._tiptapEditor.commands.toggleVersioning()
                setIsAutoVersioning(!isAutoVersioning)
                console.log('Log history')
              }}>
              Toggle versioning (is {isAutoVersioning ? 'off' : 'on'})
            </Button>

            <div>Has changes: {hasChanges ? 'true' : 'false'}</div>

            <pre>{JSON.stringify(latestVersion, null, 2)}</pre>

            <pre>{JSON.stringify(currentVersion, null, 2)}</pre>

            <pre>{JSON.stringify(versions, null, 2)}</pre>
          </TabsContent>
        </Tabs>
      </div>
    </BlockNoteView>
  )
}
