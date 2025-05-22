'use client'

import {memo, useEffect, useMemo, useState} from 'react'

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
import {Editor} from '@tiptap/core'
import * as Y from 'yjs'

import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'

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
  await new Promise(resolve => setTimeout(resolve, 10))

  return userIds.map(userId => ({
    id: userId,
    username: userId,
    avatarUrl: `https://picsum.photos/seed/${userId}/200/300`,
  }))
}

// EDITOR FIELD COMPONENT

function getOrCreateSubFragment(doc: Y.Doc, name: string): Y.XmlFragment {
  const defaultMap = doc.getMap('default')
  let subFragment = defaultMap.get(name) as Y.XmlFragment

  if (!subFragment || !(subFragment instanceof Y.XmlFragment)) {
    subFragment = new Y.XmlFragment()
    defaultMap.set(name, subFragment)
  }

  return subFragment
}

interface EditorFieldProps {
  fieldName: string
  provider: TiptapCollabProvider
  threadStore: TiptapThreadStore
  user: {name: string; color: string}
  yDoc: Y.Doc
  isProviderSynced: boolean
  setActiveField: (params: {fieldName: string; editor: BlockNoteEditor}) => void
}

const EditorField = memo(function EditorField({
  fieldName,
  provider,
  threadStore,
  user,
  yDoc,
  isProviderSynced,
  setActiveField,
}: EditorFieldProps) {
  const subFragment = useMemo(() => {
    if (!isProviderSynced) return null
    return getOrCreateSubFragment(yDoc, fieldName)
  }, [fieldName, yDoc, isProviderSynced])

  const editor = useCreateBlockNote(
    {
      animations: false,
      schema,
      dictionary: blockNoteDE,
      ...(subFragment
        ? {
            collaboration: {
              provider,
              fragment: subFragment,
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
          }
        : {}),
    },
    [provider, threadStore, subFragment],
  )

  return (
    <BlockNoteView
      editor={editor}
      sideMenu={false}
      onSelectionChange={() => {
        // @ts-expect-error: ignoring for now
        setActiveField({fieldName, editor})
      }}
      data-theming-blocknote-multifield
    />
  )
})

// MAIN COMPONENT

export default function CollabEditor({appId, document, user, className}: EditorProps) {
  const [isProviderSynced, setIsProviderSynced] = useState(false)
  const [, setHasChanges] = useState(false)
  const [activeField, setActiveField] = useState<{
    fieldName: string
    editor: BlockNoteEditor
  } | null>(null)
  const [, setActiveTipTapEditor] = useState<Editor | null>(null)

  const [sidebarTab, setSidebarTab] = useState<TabContent>(TabContent.Comments)
  const [commentFilter, setCommentFilter] = useState<CommentFilterStatus>(CommentFilterStatus.Open)
  const [commentSort, setCommentSort] = useState<CommentSortOrder>(CommentSortOrder.Position)

  const [yDoc, provider, threadStore] = useMemo(() => {
    const yDoc = new Y.Doc()

    const provider = new TiptapCollabProvider({
      appId: appId,
      name: document.name,
      token: user.token,
      document: yDoc,
    })

    const threadStore = new TiptapThreadStore(
      user.name,
      provider,
      new DefaultThreadStoreAuth(user.name, 'editor'),
    )

    return [yDoc, provider, threadStore]
  }, [document, user, appId])

  useEffect(() => {
    const onUpdate = () => {
      // console.log('Document updated')
      setHasChanges(true)
    }

    const onSynced = () => {
      // console.log('Provider synced')
      setIsProviderSynced(true)
      yDoc.on('update', onUpdate)
    }

    provider.on('synced', onSynced)

    return () => {
      provider.off('synced', onSynced)
      yDoc.off('update', onUpdate)
    }
  }, [yDoc, provider])

  // note: does not have exactly the same capabilities as the normal tip tap editor
  useEffect(() => {
    if (activeField?.editor._tiptapEditor.can) {
      setActiveTipTapEditor(activeField.editor._tiptapEditor as unknown as Editor)
    } else {
      setActiveTipTapEditor(null)
    }
  }, [activeField])

  return (
    <div className={cn(`flex h-full flex-row overflow-hidden rounded-xl border`, className)}>
      <div className="flex flex-1 flex-col">
        {isProviderSynced &&
          document.fields.map(fieldName => (
            <EditorField
              key={fieldName}
              fieldName={fieldName}
              provider={provider}
              threadStore={threadStore}
              user={user}
              yDoc={yDoc}
              isProviderSynced={isProviderSynced}
              setActiveField={setActiveField}
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
          To be removed...
        </TabsContent>

        <TabsContent value={TabContent.History}>Coming soon...</TabsContent>
      </Tabs>
    </div>
  )
}
