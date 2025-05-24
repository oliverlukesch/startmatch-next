'use client'

import {memo, useRef} from 'react'

import {Language, TextOptions, Tone} from '@tiptap-pro/extension-ai'
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
  Languages,
  List,
  ListOrdered,
  ListRestart,
  SpellCheck,
} from 'lucide-react'

import {Button} from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {Separator} from '@/components/ui/separator'
import {TooltipProvider} from '@/components/ui/tooltip'

import ToolbarButton from './ToolbarButton'

interface TextMenuProps {
  editor: Editor
}

const sharedTextOptions: TextOptions = {
  modelName: 'gpt-4o',
  format: 'rich-text',
  stream: true,
  // startsInline helps with fixing TipTap collaboration-related issues
  startsInline: true,
}

const supportedTones: Tone[] = [
  'informative',
  'academic',
  'persuasive',
  'confident',
  'business',
  'inspirational',
  'objective',
]

const supportedLanguages = ['en', 'de']

const languageKeys: Record<(typeof supportedLanguages)[number], string> = {
  en: 'English',
  de: 'German',
}

export const TextMenu = memo(function TextMenu({editor}: TextMenuProps) {
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
        <DropdownMenu onOpenChange={state => (dropDownIsOpenRef.current = state)}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Edit with AI" className="h-8 w-8">
              <Bot className="size-4" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" sideOffset={8} alignOffset={-4}>
            <div className="grid grid-cols-2 gap-2">
              <DropdownMenuItem
                onClick={() => {
                  editor.chain().focus().aiShorten(sharedTextOptions).run()
                }}>
                <ChevronsDownUp />
                Shorten
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  editor.chain().focus().aiExtend(sharedTextOptions).run()
                }}>
                <ChevronsUpDown />
                Extend
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  editor.chain().focus().aiFixSpellingAndGrammar(sharedTextOptions).run()
                }}>
                <SpellCheck />
                Correct
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  editor
                    .chain()
                    .focus()
                    .aiComplete({append: true, ...sharedTextOptions})
                    .run()
                }}>
                <ArrowRight />
                Continue
              </DropdownMenuItem>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Languages className="mr-2 size-4 text-slate-500" />
                  Translate to
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {supportedLanguages.map(language => (
                    <DropdownMenuItem
                      key={language}
                      onClick={() => {
                        editor
                          .chain()
                          .focus()
                          .aiTranslate(language as Language, sharedTextOptions)
                          .run()
                      }}>
                      {languageKeys[language] || language.toUpperCase()}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ListRestart className="mr-2 size-4 text-slate-500" />
                  Change tone
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {supportedTones.map(tone => (
                    <DropdownMenuItem
                      key={tone}
                      onClick={() => {
                        editor.chain().focus().aiAdjustTone(tone, sharedTextOptions).run()
                      }}>
                      {tone.charAt(0).toUpperCase() + tone.slice(1)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </div>

            <DropdownMenuSeparator />

            <div
              contentEditable="plaintext-only"
              className="text-menu-prompt-input m-1 mt-2 max-h-64 min-h-16 w-80 max-w-80 overflow-y-auto rounded p-2 outline-none focus:bg-slate-50 focus:ring-1 focus:ring-slate-300"
              data-placeholder="Enter your prompt here..."
              role="textbox"
              tabIndex={0}
              onKeyDown={event => {
                event.stopPropagation()

                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  const target = event.target as HTMLDivElement
                  if (target) console.log(target.innerText)
                }
              }}
            />
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
