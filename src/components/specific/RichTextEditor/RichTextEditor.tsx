'use client'

import '@blocknote/core/fonts/inter.css'
import {BlockNoteView} from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import {useCreateBlockNote} from '@blocknote/react'

import {cn} from '@/lib/utils'

export default function RichTextEditor({className}: {className?: string}) {
  const editor = useCreateBlockNote()
  return <BlockNoteView editor={editor} className={cn('rounded-md border p-1', className)} />
}
