'use client'

import {useMemo} from 'react'

import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  defaultStyleSpecs,
} from '@blocknote/core'
import {DefaultThreadStoreAuth, TiptapThreadStore} from '@blocknote/core/comments'
import '@blocknote/core/fonts/inter.css'
import {BlockNoteView} from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import {useCreateBlockNote} from '@blocknote/react'
import {TiptapCollabProvider} from '@hocuspocus/provider'
import * as Y from 'yjs'

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
    },
    [provider, threadStore],
  )

  return <BlockNoteView editor={editor} sideMenu={false} data-theming-primary-rte {...props} />
}
