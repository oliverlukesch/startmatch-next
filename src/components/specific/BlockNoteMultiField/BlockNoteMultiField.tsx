'use client'

import {useEffect, useMemo, useState} from 'react'

import {
  BlockNoteEditor,
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
import {useCreateBlockNote} from '@blocknote/react'
import {TiptapCollabProvider} from '@hocuspocus/provider'
import {TiptapTransformer} from '@hocuspocus/transformer'
import * as Y from 'yjs'

import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'

import {ThreadsSidebar} from './CustomThreadsSidebar'
import './style.css'

// TYPES AND ENUMS

export type EditorProps = {
  className?: string
  documentName: string
  documentFields: string[]
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

// EDITOR FIELD COMPONENT

interface EditorFieldProps {
  fieldName: string
  provider: TiptapCollabProvider
  threadStore: TiptapThreadStore
  user: {name: string; color: string}
  doc: Y.Doc
  setActiveEditor: (editor: BlockNoteEditor, fieldName: string) => void
}

const EditorField = ({
  fieldName,
  provider,
  threadStore,
  user,
  doc,
  setActiveEditor,
}: EditorFieldProps) => {
  const editor = useCreateBlockNote(
    {
      animations: false,
      schema,
      collaboration: {
        provider,
        fragment: doc.getXmlFragment(fieldName),
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
    },
    [provider, threadStore, fieldName],
  )

  return (
    <BlockNoteView
      editor={editor}
      sideMenu={false}
      onSelectionChange={() => {
        // @ts-expect-error: ignoring for now
        setActiveEditor(editor, fieldName)
      }}
      data-theming-blocknote-multifield
    />
  )
}

// MAIN COMPONENT

export default function CollabEditor({
  documentName,
  user,
  appId,
  documentFields,
  className,
}: EditorProps) {
  const [activeEditorData, setActiveEditorData] = useState<{
    editor: BlockNoteEditor
    fieldName: string
  } | null>(null)

  const [sidebarTab, setSidebarTab] = useState<TabContent>(TabContent.Comments)
  const [commentFilter, setCommentFilter] = useState<CommentFilterStatus>(CommentFilterStatus.Open)
  const [commentSort, setCommentSort] = useState<CommentSortOrder>(CommentSortOrder.Position)

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

  useEffect(() => {
    if (activeEditorData) {
      console.log(
        'active editor comments',
        // @ts-expect-error: ignoring for now
        activeEditorData.editor.comments.threadStore.getThreads(),
      )
      console.log(JSON.stringify(TiptapTransformer.fromYdoc(doc, activeEditorData.fieldName)))
    }
  }, [activeEditorData])

  const handleSetActiveEditor = (editor: BlockNoteEditor, fieldName: string) => {
    setActiveEditorData({editor, fieldName})
  }

  return (
    <div className={`flex h-full flex-row overflow-hidden rounded-xl border ${className || ''}`}>
      <div className="flex flex-1 flex-col">
        {documentFields.map(fieldName => (
          <EditorField
            key={fieldName}
            fieldName={fieldName}
            provider={provider}
            threadStore={threadStore}
            user={user}
            doc={doc}
            setActiveEditor={handleSetActiveEditor}
          />
        ))}
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

          {!!activeEditorData && (
            <BlockNoteView
              editor={activeEditorData.editor}
              renderEditor={false}
              comments={false}
              sideMenu={false}
              data-theming-blocknote-multifield>
              <ThreadsSidebar filter={commentFilter} sort={commentSort} />
            </BlockNoteView>
          )}
        </TabsContent>

        <TabsContent value={TabContent.History}>Coming soon...</TabsContent>
      </Tabs>
    </div>
  )
}
