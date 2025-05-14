// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

'use client'

import React, {useCallback, useEffect} from 'react'

import {TiptapCollabProvider} from '@hocuspocus/provider'
import CollaborationHistory from '@tiptap-pro/extension-collaboration-history'
import {Collaboration} from '@tiptap/extension-collaboration'
import {CollaborationCursor} from '@tiptap/extension-collaboration-cursor'
import {EditorContent, useEditor} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import * as Y from 'yjs'

import {VersioningModal} from './VersioningModal.jsx'
import './style.css'
import {renderDate} from './utils.js'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

const colors = ['#958DF1', '#F98181', '#FBBC88', '#FAF594', '#70CFF8', '#94FADB', '#B9F18D']
const names = [
  'Lea Thompson',
  'Cyndi Lauper',
  'Tom Cruise',
  'Madonna',
  'Jerry Hall',
  'Joan Collins',
  'Winona Ryder',
  'Christina Applegate',
  'Alyssa Milano',
  'Molly Ringwald',
  'Ally Sheedy',
  'Debbie Harry',
  'Olivia Newton-John',
  'Elton John',
  'Michael J. Fox',
  'Axl Rose',
  'Emilio Estevez',
  'Ralph Macchio',
  'Rob Lowe',
  'Jennifer Grey',
  'Mickey Rourke',
  'John Cusack',
  'Matthew Broderick',
  'Justine Bateman',
  'Lisa Bonet',
]

const getRandomElement = list => list[Math.floor(Math.random() * list.length)]

const getRandomColor = () => getRandomElement(colors)
const getRandomName = () => getRandomElement(names)
const pickedName = getRandomName()

const doc = new Y.Doc()

const date = new Date()
const dayOfTheYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24)

const provider = new TiptapCollabProvider({
  appId: 'y9w5pjo9',
  name: `room-collab-history-${dayOfTheYear}`,
  document: doc,
  token:
    'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE3NDcyMTMzNjUsIm5iZiI6MTc0NzIxMzM2NSwiZXhwIjoxNzQ3Mjk5NzY1LCJpc3MiOiJodHRwczovL2Nsb3VkLnRpcHRhcC5kZXYiLCJhdWQiOiJ5OXc1cGpvOSJ9.jQunD81DGphtf5PwvsVeSS1vyH7Dv2H5UHVDUK6UByU',
  user: pickedName,
})

const MenuBar = ({editor}) => {
  if (!editor) {
    return null
  }

  return (
    <div className="control-group">
      <div className="button-group">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'is-active' : ''}>
          Bold
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'is-active' : ''}>
          Italic
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCode().run()}
          disabled={!editor.can().chain().focus().toggleCode().run()}
          className={editor.isActive('code') ? 'is-active' : ''}>
          Code
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({level: 1}).run()}
          className={editor.isActive('heading', {level: 1}) ? 'is-active' : ''}>
          H1
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({level: 2}).run()}
          className={editor.isActive('heading', {level: 2}) ? 'is-active' : ''}>
          H2
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({level: 3}).run()}
          className={editor.isActive('heading', {level: 3}) ? 'is-active' : ''}>
          H3
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'is-active' : ''}>
          Bullet list
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={editor.isActive('codeBlock') ? 'is-active' : ''}>
          Code block
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive('blockquote') ? 'is-active' : ''}>
          Blockquote
        </button>
      </div>
    </div>
  )
}

export const TestEditor = () => {
  const [latestVersion, setLatestVersion] = React.useState(null)
  const [currentVersion, setCurrentVersion] = React.useState(null)
  const [versions, setVersions] = React.useState([])
  const [isAutoVersioning, setIsAutoVersioning] = React.useState(false)
  const [versioningModalOpen, setVersioningModalOpen] = React.useState(false)
  const [hasChanges, setHasChanges] = React.useState(false)

  const showVersioningModal = useCallback(() => {
    setVersioningModalOpen(true)
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false,
      }),
      Collaboration.configure({
        document: doc,
      }),
      CollaborationCursor.configure({
        provider,
        user: {
          name: pickedName,
          color: getRandomColor(),
        },
      }),
      CollaborationHistory.configure({
        provider,
        onUpdate: data => {
          setVersions(data.versions)
          setIsAutoVersioning(data.versioningEnabled)
          setLatestVersion(data.version)
          setCurrentVersion(data.currentVersion)
        },
      }),
    ],
  })

  useEffect(() => {
    const onUpdate = () => {
      setHasChanges(true)
    }

    const onSynced = () => {
      doc.on('update', onUpdate)
    }

    provider.on('synced', onSynced)

    return () => {
      provider.off('synced', onSynced)
      doc.off('update', onUpdate)
    }
  }, [doc])

  const [commitDescription, setCommitDescription] = React.useState('')

  const handleCommitDescriptionChange = event => {
    setCommitDescription(event.target.value)
  }

  const handleNewVersion = useCallback(
    e => {
      e.preventDefault()
      if (!commitDescription) {
        return
      }
      editor.commands.saveVersion(commitDescription)
      setCommitDescription('')
      alert(`Version ${commitDescription} created! Open the version history to see all versions.`)
      setHasChanges(false)
    },
    [editor, commitDescription],
  )

  const handleVersioningClose = useCallback(() => {
    setVersioningModalOpen(false)
  }, [])

  const handleRevert = useCallback(
    (version, versionData) => {
      const versionTitle = versionData ? versionData.name || renderDate(versionData.date) : version

      editor.commands.revertToVersion(
        version,
        `Revert to ${versionTitle}`,
        `Unsaved changes before revert to ${versionTitle}`,
      )
    },
    [editor],
  )

  if (!editor) {
    return null
  }

  return (
    <>
      <VersioningModal
        versions={versions}
        isOpen={versioningModalOpen}
        onClose={handleVersioningClose}
        onRevert={handleRevert}
        currentVersion={currentVersion}
        latestVersion={latestVersion}
        provider={provider}
      />
      <div className="col-group">
        <div className="main">
          <MenuBar editor={editor} />
          <EditorContent editor={editor} />
        </div>
        <div className="sidebar">
          <div className="sidebar-options">
            <div className="option-group">
              <div className="label-large">Auto versioning</div>
              <div className="switch-group">
                <label>
                  <input
                    type="radio"
                    name="auto-versioning"
                    onChange={() => !isAutoVersioning && editor.commands.toggleVersioning()}
                    checked={isAutoVersioning}
                  />
                  Enable
                </label>
                <label>
                  <input
                    type="radio"
                    name="auto-versioning"
                    onChange={() => isAutoVersioning && editor.commands.toggleVersioning()}
                    checked={!isAutoVersioning}
                  />
                  Disable
                </label>
              </div>
            </div>
            <hr />
            <div className="option-group">
              <div className="label-large">Manual versioning</div>
              <div className="label-small">
                Make adjustments to the document to manually save a new version.
              </div>
              <form className="commit-panel">
                <input
                  disabled={!hasChanges}
                  type="text"
                  placeholder="Version name"
                  value={commitDescription}
                  onChange={handleCommitDescriptionChange}
                />
                <button
                  disabled={!hasChanges || commitDescription.length === 0}
                  type="submit"
                  onClick={handleNewVersion}>
                  Create
                </button>
              </form>
            </div>
            <hr />
            <button className="primary" type="button" onClick={showVersioningModal}>
              Show history
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
