'use client'

import type {Editor} from '@tiptap/core'
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Redo,
  Undo,
} from 'lucide-react'

import {Button} from '@/components/ui/button'
import {Separator} from '@/components/ui/separator'
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/components/ui/tooltip'

interface EditorToolbarProps {
  editor: Editor | null
}

interface ToolbarButtonProps {
  label: string
  icon: React.ElementType
  onClick: () => void
  isDisabled?: boolean
  isActive?: boolean
}

const ToolbarButton = ({
  label,
  icon: Icon,
  onClick,
  isDisabled = false,
  isActive = false,
}: ToolbarButtonProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant={isActive ? 'secondary' : 'ghost'}
        size="icon"
        disabled={isDisabled}
        onClick={onClick}
        aria-label={label}>
        <Icon className="size-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>{label}</p>
    </TooltipContent>
  </Tooltip>
)

export const EditorToolbar = ({editor}: EditorToolbarProps) => {
  const commonDisabled = !editor

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex items-center gap-0.5 border-b px-2 py-1">
        <ToolbarButton
          label="Bold"
          icon={Bold}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          isDisabled={commonDisabled || !editor?.can().chain().focus().toggleBold().run()}
          isActive={editor?.isActive('bold')}
        />
        <ToolbarButton
          label="Italic"
          icon={Italic}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          isDisabled={commonDisabled || !editor?.can().chain().focus().toggleItalic().run()}
          isActive={editor?.isActive('italic')}
        />

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolbarButton
          label="Heading 1"
          icon={Heading1}
          onClick={() => editor?.chain().focus().toggleHeading({level: 1}).run()}
          isDisabled={
            commonDisabled || !editor?.can().chain().focus().toggleHeading({level: 1}).run()
          }
          isActive={editor?.isActive('heading', {level: 1})}
        />
        <ToolbarButton
          label="Heading 2"
          icon={Heading2}
          onClick={() => editor?.chain().focus().toggleHeading({level: 2}).run()}
          isDisabled={
            commonDisabled || !editor?.can().chain().focus().toggleHeading({level: 2}).run()
          }
          isActive={editor?.isActive('heading', {level: 2})}
        />
        <ToolbarButton
          label="Heading 3"
          icon={Heading3}
          onClick={() => editor?.chain().focus().toggleHeading({level: 3}).run()}
          isDisabled={
            commonDisabled || !editor?.can().chain().focus().toggleHeading({level: 3}).run()
          }
          isActive={editor?.isActive('heading', {level: 3})}
        />

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolbarButton
          label="Bullet List"
          icon={List}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          isDisabled={commonDisabled || !editor?.can().chain().focus().toggleBulletList().run()}
          isActive={editor?.isActive('bulletList')}
        />
        <ToolbarButton
          label="Numbered List"
          icon={ListOrdered}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          isDisabled={commonDisabled || !editor?.can().chain().focus().toggleOrderedList().run()}
          isActive={editor?.isActive('orderedList')}
        />

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolbarButton
          label="Undo"
          icon={Undo}
          onClick={() => editor?.chain().focus().undo().run()}
          isDisabled={commonDisabled || !editor?.can().undo()}
        />
        <ToolbarButton
          label="Redo"
          icon={Redo}
          onClick={() => editor?.chain().focus().redo().run()}
          isDisabled={commonDisabled || !editor?.can().redo()}
        />
      </div>
    </TooltipProvider>
  )
}
