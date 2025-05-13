'use client'

import {useMemo, useState} from 'react'

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
import * as Y from 'yjs'

import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'

import './style.css'

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

type User = {
  id: string
  username: string
  avatarUrl: string
}

async function resolveUsers(userIds: string[]): Promise<User[]> {
  await new Promise(resolve => setTimeout(resolve, 100))

  return userIds.map(userId => ({
    id: userId,
    username: userId,
    avatarUrl: `https://picsum.photos/seed/${userId}/200/300`,
  }))
}

export type RichTextEditorProps = {
  className?: string
  documentName: string
  appId: string
  user: {
    name: string
    color: string
    token: string
  }
}

export default function RichTextEditor({documentName, user, appId, ...props}: RichTextEditorProps) {
  const [commentFilter, setCommentFilter] = useState<'open' | 'resolved' | 'all'>('open')
  const [commentSort, setCommentSort] = useState<'position' | 'recent-activity' | 'oldest'>(
    'position',
  )

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
    },
    [provider, threadStore],
  )

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
        <div className="max-w-80 flex-1 shrink-0 border-l bg-slate-50 p-3">
          <div className="mb-4 flex gap-2">
            <Select
              value={commentFilter}
              onValueChange={value => setCommentFilter(value as 'open' | 'resolved' | 'all')}>
              <SelectTrigger id="comment-filter" className="w-full">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={commentSort}
              onValueChange={value =>
                setCommentSort(value as 'position' | 'recent-activity' | 'oldest')
              }>
              <SelectTrigger id="comment-sort" className="w-full">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="position">Position</SelectItem>
                <SelectItem value="recent-activity">Recent Activity</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ThreadsSidebar filter={commentFilter} sort={commentSort} />
        </div>
      </div>
    </BlockNoteView>
  )
}
