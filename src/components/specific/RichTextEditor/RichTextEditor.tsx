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

import './style.css'

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
  const editor = useCreateBlockNote({animations: false, schema})

  // this works, save for later reference
  // console.log('editor', editor._tiptapEditor)

  return <BlockNoteView editor={editor} sideMenu={false} data-theming-primary-rte {...props} />
}
