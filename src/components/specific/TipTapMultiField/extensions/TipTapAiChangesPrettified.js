/* eslint-disable */

'use strict'

Object.defineProperty(exports, '__esModule', {value: true})

const core = require('@tiptap/core')
const prosemirrorState = require('@tiptap/pm/state')
const prosemirrorView = require('@tiptap/pm/view')
const prosemirrorChangeset = require('@tiptap/pm/changeset')
const prosemirrorModel = require('@tiptap/pm/model')

/**
 * Calculates the differences between two ProseMirror documents.
 * @param {{ previousDoc: prosemirrorModel.Node, currentDoc: prosemirrorModel.Node }} params
 * @returns {Array<{id: string, oldRange: {from: number, to: number}, newRange: {from: number, to: number}}>}
 */
function getAiChanges({previousDoc, currentDoc}) {
  const transaction = prosemirrorState.EditorState.create({doc: previousDoc}).tr
  transaction.replaceWith(0, transaction.doc.content.size, currentDoc)

  const mappedSteps = transaction.steps.map(step => step.getMap())
  const changeSet = prosemirrorChangeset.ChangeSet.create(previousDoc).addSteps(
    currentDoc,
    mappedSteps,
    null,
  )

  return prosemirrorChangeset
    .simplifyChanges(changeSet.changes, currentDoc)
    .map((change, index) => ({
      id: (index + 1).toString(),
      oldRange: {from: change.fromA, to: change.toA},
      newRange: {from: change.fromB, to: change.toB},
    }))
}

/**
 * Renders a ProseMirror node or fragment to an HTMLElement, respecting node views.
 * @param {{ node: prosemirrorModel.Node | prosemirrorModel.Fragment, editor: core.Editor, pos?: number }} params
 * @returns {DocumentFragment}
 */
function renderNodeToHTMLElement({node, editor, pos = 0}) {
  const nodeViews = editor.extensionManager.nodeViews
  const fragment = new DocumentFragment()
  let currentPos = pos

  prosemirrorModel.Fragment.from(node).forEach(childNode => {
    if (!(childNode.type.name in nodeViews)) {
      fragment.appendChild(
        prosemirrorModel.DOMSerializer.fromSchema(editor.schema).serializeNode(childNode),
      )
      currentPos += childNode.nodeSize
      return
    }

    const nodeViewInstance = nodeViews[childNode.type.name](
      childNode,
      editor.view,
      () => currentPos, // getPos
      [], // decorations
      prosemirrorView.DecorationSet.empty,
    )

    if (nodeViewInstance.contentDOM) {
      nodeViewInstance.contentDOM.appendChild(
        renderNodeToHTMLElement({node: childNode.content, editor, pos: currentPos}),
      )
    }
    fragment.appendChild(nodeViewInstance.dom)
    currentPos += childNode.nodeSize
  })

  return fragment
}

/**
 * Returns the initial state for the AI Changes ProseMirror plugin.
 * @returns {{previousDoc: null | prosemirrorModel.Node, changes: Array<any>, selectedChange: null | any, decorations: prosemirrorView.DecorationSet, showAiChanges: boolean}}
 */
function getAiChangesProsemirrorPluginInitialState() {
  return {
    previousDoc: null,
    changes: [],
    selectedChange: null,
    decorations: prosemirrorView.DecorationSet.empty,
    showAiChanges: true,
  }
}

/**
 * Creates the ProseMirror plugin for handling AI changes.
 * @param {{ editor: core.Editor, options: any, storage: any }} extensionParams
 * @returns {prosemirrorState.Plugin}
 */
function createAiChangesProsemirrorPlugin({editor, options, storage}) {
  const pluginKey = storage.pluginKey

  return new prosemirrorState.Plugin({
    key: pluginKey,
    state: {
      init: getAiChangesProsemirrorPluginInitialState,
      apply(transaction, pluginState, oldEditorState, newEditorState) {
        let {previousDoc: currentPreviousDoc, showAiChanges: currentShowAiChanges} = pluginState
        const meta = transaction.getMeta(pluginKey)

        if (meta) {
          if (meta.previousDoc !== undefined) {
            currentPreviousDoc = meta.previousDoc
          }
          if (meta.showAiChanges !== undefined) {
            currentShowAiChanges = meta.showAiChanges
          }
        }

        if (!currentPreviousDoc) {
          return {
            ...getAiChangesProsemirrorPluginInitialState(),
            showAiChanges: currentShowAiChanges,
          }
        }

        const updatedChanges =
          transaction.docChanged || meta
            ? getAiChanges({previousDoc: currentPreviousDoc, currentDoc: newEditorState.doc})
            : pluginState.changes

        const newlySelectedChange =
          updatedChanges.find(
            change =>
              change.newRange.from <= newEditorState.selection.from &&
              change.newRange.to >= newEditorState.selection.to,
          ) ?? null

        if (!currentShowAiChanges) {
          return {
            previousDoc: currentPreviousDoc,
            changes: updatedChanges,
            selectedChange: newlySelectedChange,
            decorations: prosemirrorView.DecorationSet.empty,
            showAiChanges: currentShowAiChanges,
          }
        }

        const decorationsNeedUpdate =
          meta ||
          updatedChanges !== pluginState.changes ||
          newlySelectedChange?.id !== pluginState.selectedChange?.id

        const newDecorations = decorationsNeedUpdate
          ? prosemirrorView.DecorationSet.create(
              newEditorState.doc,
              updatedChanges.flatMap(change =>
                options.getCustomDecorations({
                  change,
                  changes: updatedChanges,
                  isSelected: newlySelectedChange?.id === change.id,
                  getDefaultDecorations: function () {
                    return currentPreviousDoc
                      ? [
                          prosemirrorView.Decoration.widget(
                            change.newRange.from,
                            () => {
                              const oldContentMarker = document.createElement('span')
                              oldContentMarker.className = 'tiptap-ai-changes--old'
                              oldContentMarker.addEventListener('click', event => {
                                event.stopPropagation()
                                editor.commands.selectAiChange(change.id)
                              })
                              oldContentMarker.appendChild(
                                renderNodeToHTMLElement({
                                  node: currentPreviousDoc.slice(
                                    change.oldRange.from,
                                    change.oldRange.to,
                                  ).content,
                                  editor,
                                }),
                              )
                              return oldContentMarker
                            },
                            {side: -1},
                          ),
                          prosemirrorView.Decoration.inline(
                            change.newRange.from,
                            change.newRange.to,
                            {class: 'tiptap-ai-changes--new'},
                          ),
                        ]
                      : []
                  },
                  editor,
                  previousDoc: currentPreviousDoc,
                  currentDoc: newEditorState.doc,
                }),
              ),
            )
          : pluginState.decorations

        return {
          previousDoc: currentPreviousDoc,
          changes: updatedChanges,
          selectedChange: newlySelectedChange,
          decorations: newDecorations,
          showAiChanges: currentShowAiChanges,
        }
      },
    },
    props: {
      decorations(editorState) {
        return this.getState(editorState)?.decorations
      },
    },
  })
}

const AiChangesExtension = core.Extension.create({
  name: 'aiChanges',

  addStorage() {
    return {
      pluginKey: new prosemirrorState.PluginKey('aiChanges'),
      getChanges: () => [],
      getSelectedChange: () => null,
      getIsTrackingAiChanges: () => false,
      getPreviousDoc: () => null,
      getIsShowingAiChanges: () => true,
    }
  },

  addProseMirrorPlugins() {
    return [createAiChangesProsemirrorPlugin(this)]
  },

  addCommands() {
    const getPluginMeta = transaction => transaction.getMeta(this.storage.pluginKey)
    const setPluginMeta = (transaction, metaPayload) => {
      const currentMeta = getPluginMeta(transaction) ?? {}
      return transaction.setMeta(this.storage.pluginKey, {...currentMeta, ...metaPayload})
    }

    return {
      startTrackingAiChanges:
        docToTrack =>
        ({tr, dispatch}) => {
          if (!dispatch) return true
          return dispatch(setPluginMeta(tr, {previousDoc: docToTrack ?? tr.doc}))
        },
      stopTrackingAiChanges:
        () =>
        ({tr, dispatch}) => {
          if (!dispatch) return true
          return dispatch(setPluginMeta(tr, {previousDoc: null}))
        },
      acceptAllAiChanges:
        () =>
        ({state, dispatch}) => {
          const pluginState = this.storage.pluginKey.getState(state)
          if (!pluginState || pluginState.previousDoc === null) return false
          if (dispatch) {
            return dispatch(setPluginMeta(state.tr, {previousDoc: state.doc}))
          }
          return true
        },
      rejectAllAiChanges:
        () =>
        ({state, commands}) => {
          const pluginState = this.storage.pluginKey.getState(state)
          if (!pluginState || pluginState.previousDoc === null) return false
          return commands.setContent(pluginState.previousDoc)
        },
      acceptAiChange:
        changeId =>
        ({state: currentState, dispatch, tr: currentTransaction}) => {
          const pluginState = this.storage.pluginKey.getState(currentState)
          if (!pluginState) return false

          const changeToAccept = pluginState.changes.find(change => change.id === changeId)
          if (!changeToAccept) return false

          const baseDocForAccept =
            getPluginMeta(currentTransaction)?.previousDoc ?? pluginState.previousDoc
          if (!baseDocForAccept) return false

          if (dispatch) {
            const previousDocTransaction =
              getPluginMeta(currentTransaction)?.previousDocTransaction ??
              prosemirrorState.EditorState.create({doc: baseDocForAccept}).tr

            const updatedTransaction = previousDocTransaction.replaceWith(
              previousDocTransaction.mapping.map(changeToAccept.oldRange.from),
              previousDocTransaction.mapping.map(changeToAccept.oldRange.to),
              currentTransaction.doc.slice(
                currentTransaction.mapping.map(changeToAccept.newRange.from),
                currentTransaction.mapping.map(changeToAccept.newRange.to),
              ).content,
            )
            return dispatch(
              setPluginMeta(currentTransaction, {
                previousDocTransaction: updatedTransaction,
                previousDoc: updatedTransaction.doc,
              }),
            )
          }
          return true
        },
      rejectAiChange:
        changeId =>
        ({state: currentState, dispatch, tr: currentTransaction}) => {
          const pluginState = this.storage.pluginKey.getState(currentState)
          if (!pluginState) return false

          const changeToReject = pluginState.changes.find(change => change.id === changeId)
          if (!changeToReject) return false

          const baseDocForRevert =
            getPluginMeta(currentTransaction)?.previousDoc ?? pluginState.previousDoc
          if (!baseDocForRevert) return false

          if (dispatch) {
            const previousDocTransaction =
              getPluginMeta(currentTransaction)?.previousDocTransaction ??
              prosemirrorState.EditorState.create({doc: baseDocForRevert}).tr

            currentTransaction.replaceWith(
              currentTransaction.mapping.map(changeToReject.newRange.from),
              currentTransaction.mapping.map(changeToReject.newRange.to),
              baseDocForRevert.slice(
                previousDocTransaction.mapping.map(changeToReject.oldRange.from),
                previousDocTransaction.mapping.map(changeToReject.oldRange.to),
              ).content,
            )
            // Note: The original code mutated `currentTransaction` and then dispatched it.
            // Here, we assume `dispatch(currentTransaction)` will be called by the command chain.
            // If `setPluginMeta` is needed to update `previousDoc` after rejection, it should be added.
            return dispatch(currentTransaction)
          }
          return true
        },
      setShowAiChanges:
        showChangesFlag =>
        ({tr, dispatch}) => {
          if (!dispatch) return true
          return dispatch(setPluginMeta(tr, {showAiChanges: showChangesFlag}))
        },
      selectAiChange:
        changeId =>
        ({commands}) => {
          const targetChange = this.storage.getChanges().find(change => change.id === changeId)
          if (!targetChange) return false
          return commands.setTextSelection({
            from: targetChange.newRange.from,
            to: targetChange.newRange.from, // Selects the start of the change
          })
        },
    }
  },

  onCreate() {
    const getPluginState = () => this.storage.pluginKey.getState(this.editor.state)

    this.storage.getChanges = () => {
      return getPluginState()?.changes ?? []
    }
    this.storage.getSelectedChange = () => {
      return getPluginState()?.selectedChange ?? null
    }
    this.storage.getIsTrackingAiChanges = () => {
      return Boolean(getPluginState()?.previousDoc)
    }
    this.storage.getPreviousDoc = () => {
      return getPluginState()?.previousDoc ?? null
    }
    this.storage.getIsShowingAiChanges = () => {
      // Default to true if not explicitly set to false
      const state = getPluginState()
      return state ? state.showAiChanges !== false : true
    }
  },
})

exports.createAiChangesProsemirrorPlugin = createAiChangesProsemirrorPlugin
exports.default = AiChangesExtension
exports.getAiChanges = getAiChanges
exports.getAiChangesProsemirrorPluginInitialState = getAiChangesProsemirrorPluginInitialState
exports.renderToHTMLElement = renderNodeToHTMLElement
