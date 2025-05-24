'use client'

import {memo, useRef} from 'react'

import {TextOptions} from '@tiptap-pro/extension-ai'
import type {Editor} from '@tiptap/core'
import {BubbleMenu} from '@tiptap/react'
import {
  ArrowRight,
  Bold,
  Bot,
  ChevronsDownUp,
  ChevronsUpDown,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  MessageCircle,
  SpellCheck,
} from 'lucide-react'

import {Button} from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
        className="h-8 w-8">
        <Icon className="size-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
)

interface DropDownButtonProps {
  label: string
  icon: React.ElementType
  onClick: () => void
}

const DropDownButton = ({label, icon: Icon, onClick}: DropDownButtonProps) => (
  <Button variant="ghost" onClick={onClick} className="justify-start">
    <Icon className="size-4" />
    {label}
  </Button>
)

const sharedTextOptions: TextOptions = {
  modelName: 'gpt-4o',
  format: 'rich-text',
  stream: true,
  // startsInline helps with fixing TipTap collaboration-related issues
  startsInline: true,
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const supportedTones = [
  'informative',
  'academic',
  'persuasive',
  'confident',
  'business',
  'inspirational',
  'objective',
]

export const EditorBubbleMenu = memo(function EditorBubbleMenu({editor}: EditorBubbleMenuProps) {
  // leave for debugging
  console.log('render BubbleMenu')

  // using a ref instead of state to prevent re-renders
  const dropDownIsOpenRef = useRef<boolean>(false)

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{
        // prevents the bubble menu from closing when clicking on the dropdown
        onHide: () => (dropDownIsOpenRef.current ? false : undefined),
      }}
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
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Edit with AI" className="h-8 w-8">
              <Bot className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="flex w-40 flex-col gap-2 p-1"
            align="start"
            sideOffset={8}
            alignOffset={-4}>
            <DropDownButton
              label="Shorten"
              icon={ChevronsDownUp}
              onClick={() => {
                editor.chain().focus().aiShorten(sharedTextOptions).run()
              }}
            />
            <DropDownButton
              label="Extend"
              icon={ChevronsUpDown}
              onClick={() => {
                editor.chain().focus().aiExtend(sharedTextOptions).run()
              }}
            />
            <DropDownButton
              label="Correct"
              icon={SpellCheck}
              onClick={() => {
                editor.chain().focus().aiFixSpellingAndGrammar(sharedTextOptions).run()
              }}
            />
            <DropDownButton
              label="Tone: Academic"
              icon={MessageCircle}
              onClick={() => {
                editor.chain().focus().aiAdjustTone('academic', sharedTextOptions).run()
              }}
            />
            <DropDownButton
              label="Tone: Business"
              icon={MessageCircle}
              onClick={() => {
                editor.chain().focus().aiAdjustTone('business', sharedTextOptions).run()
              }}
            />
            <DropDownButton
              label="Tone: Persuasive"
              icon={MessageCircle}
              onClick={() => {
                editor.chain().focus().aiAdjustTone('persuasive', sharedTextOptions).run()
              }}
            />
            <DropDownButton
              label="Continue"
              icon={ArrowRight}
              onClick={() => {
                editor
                  .chain()
                  .focus()
                  .aiComplete({append: true, ...sharedTextOptions})
                  .run()
              }}
            />
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="mx-1 h-6!" />

        <DropdownMenu onOpenChange={state => (dropDownIsOpenRef.current = state)}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Edit with AI" className="h-8 w-8">
              <Bot className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={8} alignOffset={-4}>
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Billing</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Team</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
