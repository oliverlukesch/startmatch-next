'use client'

import {memo} from 'react'

import type {Editor} from '@tiptap/core'
import {BubbleMenu} from '@tiptap/react'
import {Bold, Bot, Heading1, Heading2, Heading3, Italic, List, ListOrdered} from 'lucide-react'

import {Button} from '@/components/ui/button'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {Separator} from '@/components/ui/separator'
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/components/ui/tooltip'

interface EditorBubbleMenuProps {
  editor: Editor
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
        aria-label={label}
        className="h-8 w-8">
        <Icon className="size-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
)

export const EditorBubbleMenu = memo(function EditorBubbleMenu({editor}: EditorBubbleMenuProps) {
  // leave for debugging
  console.log('render BubbleMenu')

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({editor, from, to}) => {
        // don't show bubble menu if selection is empty
        if (from === to) return false

        let hasImage = false
        editor.state.doc.nodesBetween(from, to, node => {
          if (node.type.name === 'image') {
            hasImage = true
            return false // stop traversing
          }
        })

        return !hasImage
      }}
      className="flex items-center gap-0.5 rounded-lg border bg-background p-1 shadow-md">
      <TooltipProvider delayDuration={0}>
        {/* using the popover instead of the dropdown component as the dropdown
        causes issues with the bubble menu positioning */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Edit with AI" className="h-8 w-8">
              <Bot className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <Button
              onClick={() => {
                editor
                  .chain()
                  .focus()
                  // startsInline helps with fixing TipTap collaboration-related issues
                  .aiShorten({stream: true, format: 'rich-text', startsInline: true})
                  .run()
              }}>
              Shorten
            </Button>
            <Button
              onClick={() => {
                editor
                  .chain()
                  .focus()
                  // startsInline helps with fixing TipTap collaboration-related issues
                  .aiComplete({append: true, stream: true, format: 'rich-text', startsInline: true})
                  .run()
              }}>
              Continue
            </Button>
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="mx-1 h-6!" />

        {/* TEXT FORMATTING */}
        <ToolbarButton
          label="Bold"
          icon={Bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
          isDisabled={!editor.can().chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
        />
        <ToolbarButton
          label="Italic"
          icon={Italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isDisabled={!editor.can().chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
        />

        <Separator orientation="vertical" className="mx-1 h-6!" />

        {/* HEADINGS */}
        <ToolbarButton
          label="Heading 1"
          icon={Heading1}
          onClick={() => editor.chain().focus().toggleHeading({level: 1}).run()}
          isDisabled={!editor.can().chain().focus().toggleHeading({level: 1}).run()}
          isActive={editor.isActive('heading', {level: 1})}
        />
        <ToolbarButton
          label="Heading 2"
          icon={Heading2}
          onClick={() => editor.chain().focus().toggleHeading({level: 2}).run()}
          isDisabled={!editor.can().chain().focus().toggleHeading({level: 2}).run()}
          isActive={editor.isActive('heading', {level: 2})}
        />
        <ToolbarButton
          label="Heading 3"
          icon={Heading3}
          onClick={() => editor.chain().focus().toggleHeading({level: 3}).run()}
          isDisabled={!editor.can().chain().focus().toggleHeading({level: 3}).run()}
          isActive={editor.isActive('heading', {level: 3})}
        />

        <Separator orientation="vertical" className="mx-1 h-6!" />

        {/* LISTS */}
        <ToolbarButton
          label="Bullet List"
          icon={List}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isDisabled={!editor.can().chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
        />
        <ToolbarButton
          label="Numbered List"
          icon={ListOrdered}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isDisabled={!editor.can().chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
        />
      </TooltipProvider>
    </BubbleMenu>
  )
})
