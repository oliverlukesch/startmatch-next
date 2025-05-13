'use client'

import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  defaultStyleSpecs,
} from '@blocknote/core'
import '@blocknote/core/fonts/inter.css'
import {BlockNoteView} from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import {useCreateBlockNote} from '@blocknote/react'
import {TiptapCollabProvider} from '@hocuspocus/provider'
import * as Y from 'yjs'

import './style.css'

const doc = new Y.Doc()

const provider = new TiptapCollabProvider({
  name: 'dev.document',
  appId: 'y9w5pjo9',
  // generated inside the TipTap dashboard, valid for 24 hours, needs to be refreshed
  token:
    'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE3NDcxMzIyNTEsIm5iZiI6MTc0NzEzMjI1MSwiZXhwIjoxNzQ3MjE4NjUxLCJpc3MiOiJodHRwczovL2Nsb3VkLnRpcHRhcC5kZXYiLCJhdWQiOiJ5OXc1cGpvOSJ9.wyU7g4kxUyvz3yWXSgKgo4ivofH6w_xcurL6-1XtPyg',
  document: doc,
})

const schema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    heading: defaultBlockSpecs.heading,
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
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

export default function RichTextEditor(props: {className?: string}) {
  const editor = useCreateBlockNote({
    animations: false,
    schema,
    collaboration: {
      provider,
      fragment: doc.getXmlFragment('document-store'),
      user: {
        name: `User: ${Math.round(Math.random() * 1000)}`,
        color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
      },
      showCursorLabels: 'always',
    },
  })

  return <BlockNoteView editor={editor} sideMenu={false} data-theming-primary-rte {...props} />
}
