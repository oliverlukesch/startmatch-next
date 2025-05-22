/* eslint-disable */

'use strict'

Object.defineProperty(exports, '__esModule', {value: true})

const tiptapCore = require('@tiptap/core')
const prosemirrorState = require('@tiptap/pm/state')
const prosemirrorView = require('@tiptap/pm/view')
const prosemirrorModel = require('@tiptap/pm/model')
const prosemirrorTransform = require('@tiptap/pm/transform')

const AI_DEFAULT_BASE_URL = 'https://api.tiptap.dev/v1/ai'
const AI_DEMO_BASE_URL = 'https://api-demo.tiptap.dev/v1/ai'

class ContentAccumulator {
  constructor() {
    this.content = ''
    this.lastPartial = ''
    this.endedWithLessThan = false
  }

  static create() {
    return new ContentAccumulator()
  }

  append(textChunk) {
    if (this.endedWithLessThan) {
      this.content += '<'
    }
    this.endedWithLessThan = textChunk.endsWith('<')
    this.lastPartial = this.endedWithLessThan ? textChunk.slice(0, -1) : textChunk
    this.content += this.lastPartial
  }

  finalize() {
    if (this.endedWithLessThan) {
      this.content += '<'
    }
    this.endedWithLessThan = false
  }
}

const isSelectionSpanningMultipleBlocks = selection => {
  const {$from, $to, empty} = selection
  if (empty) {
    return false
  }
  return !($from.parent === $to.parent)
}

function getHtmlContentBetween(editor, from, to) {
  const {state} = editor
  const docFragment = state.doc.cut(from, to)
  const html = tiptapCore.getHTMLFromFragment(
    prosemirrorModel.Node.fromJSON(editor.schema, docFragment.toJSON()).content,
    editor.schema,
  )

  if (isSelectionSpanningMultipleBlocks(editor.state.selection)) {
    return html
  }
  return html.slice(html.indexOf('>') + 1, html.lastIndexOf('<'))
}

const isValidJsonString = str => {
  try {
    JSON.parse(str)
  } catch (e) {
    return false
  }
  return true
}

const resolveAiStreamRequest = async ({action, text, textOptions, extensionOptions, aborter}) => {
  const {appId, token, baseUrl: configBaseUrl} = extensionOptions
  const baseUrl =
    configBaseUrl !== null && configBaseUrl !== void 0 ? configBaseUrl : AI_DEFAULT_BASE_URL

  let fetchOptions = {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'X-App-Id': appId,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      html:
        (textOptions === null || textOptions === void 0 ? void 0 : textOptions.format) ===
          'rich-text' || undefined,
      ...textOptions,
      text: text,
      stream: true,
    }),
  }

  if (aborter && aborter instanceof AbortController) {
    fetchOptions = {...fetchOptions, signal: aborter.signal}
  }

  const response = await fetch(`${baseUrl}/text/${action}?stream=1`, fetchOptions)

  if (!response.ok) {
    const errorData = await response.json()
    const errorDetail = errorData === null || errorData === void 0 ? void 0 : errorData.error
    if (errorDetail instanceof Object) {
      const status = errorDetail === null || errorDetail === void 0 ? void 0 : errorDetail.status
      const message = errorDetail === null || errorDetail === void 0 ? void 0 : errorDetail.message
      throw new Error(`${status} ${message}`)
    }
    const errorMessage = errorData === null || errorData === void 0 ? void 0 : errorData.message
    throw new Error(`${errorDetail} ${errorMessage}`) // errorDetail might be a string here
  }
  return response === null || response === void 0 ? void 0 : response.body
}

function addAiMarkToContentNodes(contentNodeOrNodes) {
  if (!contentNodeOrNodes) {
    return {type: 'paragraph', content: []}
  }
  if (Array.isArray(contentNodeOrNodes)) {
    return contentNodeOrNodes.map(node => addAiMarkToContentNodes(node))
  }
  if (contentNodeOrNodes.content && Array.isArray(contentNodeOrNodes.content)) {
    contentNodeOrNodes.content = addAiMarkToContentNodes(contentNodeOrNodes.content)
  }
  if (contentNodeOrNodes.type === 'text') {
    const aiMark = {type: 'aiMark'}
    contentNodeOrNodes.marks = [].concat(contentNodeOrNodes.marks || []).concat(aiMark)
  }
  return contentNodeOrNodes
}

const aiStreamCommand =
  ({props, action, textOptions, extensionOptions, fetchDataFn}) =>
  async () => {
    const {editor} = props
    const {state} = editor
    const aiStorage = editor.storage.ai || editor.storage.aiAdvanced

    const resolvedTextOptions = {
      collapseToEnd: true,
      format: 'plain-text',
      ...textOptions,
    }

    let {from, to} =
      typeof resolvedTextOptions.insertAt === 'number'
        ? {from: resolvedTextOptions.insertAt, to: resolvedTextOptions.insertAt}
        : resolvedTextOptions.insertAt || state.selection

    const shouldInsert =
      (textOptions === null || textOptions === void 0 ? void 0 : textOptions.insert) !== false
    const shouldAppend = resolvedTextOptions.append && resolvedTextOptions.insertAt === undefined
    const textToProcess =
      (textOptions === null || textOptions === void 0 ? void 0 : textOptions.text) ||
      (resolvedTextOptions.plainText && resolvedTextOptions.format !== 'plain-text'
        ? state.doc.textBetween(from, to, ' ')
        : getHtmlContentBetween(editor, from, to))

    if (!textToProcess) {
      return false
    }

    Object.assign(aiStorage, {
      state: 'loading',
      response: '',
      error: undefined,
      generatedWith: {options: textOptions, action: action, range: undefined},
    })
    editor.chain().setMeta('aiResponse', aiStorage).run()

    if (extensionOptions.onLoading) {
      extensionOptions.onLoading({editor, action, isStreaming: true})
    }

    const decoder = new TextDecoder('utf-8')
    const contentAccumulator = ContentAccumulator.create()

    if (from === to && resolvedTextOptions.format === 'plain-text' && !editor.$pos(to).parent) {
      editor.chain().setTextSelection(to).createParagraphNear().run()
      from += 1
      to += 1
    }

    let currentInsertFrom = from
    let currentInsertTo = to

    return editor.commands.streamContent(shouldAppend ? to : {from, to}, async ({write}) => {
      try {
        const stream = await fetchDataFn({
          editor,
          action,
          text: textToProcess,
          textOptions: resolvedTextOptions,
          extensionOptions,
          defaultResolver: resolveAiStreamRequest,
        })

        const reader = await (stream === null || stream === void 0 ? void 0 : stream.getReader())
        if (!reader) {
          throw new Error('[tiptap-ai] fetchDataFn doesn’t return stream.')
        }

        while (true) {
          const {done, value} = await reader.read()
          if (done) break

          const chunkText = decoder.decode(value, {stream: true})

          if (isValidJsonString(chunkText)) {
            const jsonData = JSON.parse(chunkText)
            if (Object.prototype.hasOwnProperty.call(jsonData, 'error')) {
              const errorDetails = jsonData.error
              throw new Error(
                `${errorDetails.status !== null && errorDetails.status !== undefined ? errorDetails.status : 500} - ${errorDetails.message} (${errorDetails.code})`,
              )
            }
          }

          contentAccumulator.append(chunkText)

          if (aiStorage.state === 'idle') return false

          Object.assign(aiStorage, {
            state: 'loading',
            response: contentAccumulator.content,
            error: undefined,
            generatedWith: {options: textOptions, action, range: undefined},
          })

          if (extensionOptions.onChunk) {
            extensionOptions.onChunk({
              editor,
              action,
              isStreaming: true,
              chunk: contentAccumulator.lastPartial,
              response: contentAccumulator.content,
            })
          }

          try {
            if (shouldInsert) {
              const writeResult = write({
                partial: chunkText,
                transform: ({defaultTransform}) =>
                  extensionOptions.showDecorations === false
                    ? defaultTransform()
                    : tiptapCore.createNodeFromContent(
                        addAiMarkToContentNodes(defaultTransform().toJSON()),
                        editor.schema,
                      ),
                appendToChain: chain => chain.setMeta('aiResponse', aiStorage),
              })
              currentInsertFrom = writeResult.from
              currentInsertTo = writeResult.to
            } else {
              editor.chain().setMeta('aiResponse', aiStorage).run()
            }
          } catch (err) {
            if (err instanceof Error && err.message.startsWith('Invalid content for node')) {
              continue
            }
            throw err
          }
        }

        contentAccumulator.finalize()
        Object.assign(aiStorage, {
          state: 'idle',
          response: contentAccumulator.content,
          error: undefined,
          generatedWith: {options: textOptions, action, range: undefined}, // Range updated later if inserted
        })
        aiStorage.pastResponses.push(contentAccumulator.content)

        if (extensionOptions.onSuccess) {
          extensionOptions.onSuccess({
            editor,
            action,
            isStreaming: true,
            response: contentAccumulator.content,
          })
        }

        let finalChain = editor.chain().setMeta('aiResponse', aiStorage)
        if (shouldInsert) {
          const collapseToEnd =
            extensionOptions.collapseToEnd !== false && resolvedTextOptions.collapseToEnd !== false
          finalChain = finalChain.focus()
          if (extensionOptions.showDecorations !== false) {
            finalChain = finalChain
              .setTextSelection({from: currentInsertFrom, to: currentInsertTo})
              .unsetAiMark()
          }
          finalChain = finalChain.setTextSelection(
            collapseToEnd ? currentInsertTo : {from: from, to: currentInsertTo},
          )
          // Update range in storage
          if (aiStorage.generatedWith) {
            aiStorage.generatedWith.range = {from: currentInsertFrom, to: currentInsertTo}
          }
        }
        return finalChain.run(), true
      } catch (error) {
        Object.assign(aiStorage, {
          state: 'error',
          response: undefined,
          error: error,
          generatedWith: {options: textOptions, action, range: undefined},
        })
        editor.chain().setMeta('aiResponse', aiStorage).run()
        if (extensionOptions.onError) {
          extensionOptions.onError(error, {editor, action, isStreaming: true})
        }
        return false
      }
    })
    return true
  }

const acceptSuggestion = (chain, decorationNode) => {
  const suggestionText = decorationNode.type.attrs['data-suggestion']
  chain
    .focus()
    .insertContentAt(decorationNode.to - 1, suggestionText, {
      updateSelection: true,
      errorOnInvalidContent: false,
    })
    .focus()
    .run()
}

const createSuggestionDecorations = (nodesToDecorate, _docNodeSize, promptText, suggestionText) => {
  // _docNodeSize was unused
  return nodesToDecorate
    .map(nodeInfo => [
      prosemirrorView.Decoration.inline(nodeInfo.pos, nodeInfo.pos + nodeInfo.node.nodeSize, {
        class: 'tiptap-ai-prompt',
      }),
      prosemirrorView.Decoration.node(nodeInfo.pos, nodeInfo.pos + nodeInfo.node.nodeSize, {
        class: 'tiptap-ai-suggestion',
        'data-prompt': `${promptText}`,
        'data-suggestion': suggestionText,
      }),
    ])
    .flat()
}

let currentAbortController
const abortPreviousRequest = () => {
  if (currentAbortController) {
    currentAbortController.abort()
    currentAbortController = undefined // Clear after aborting
  }
}

const triggerAutocompletionFetch = async (editor, textBlocks, autocompletionOptions) => {
  abortPreviousRequest() // Abort any existing request before starting a new one
  currentAbortController = new AbortController()

  const aiExtension = editor.extensionManager.extensions.find(
    ext => ext.name === 'ai' || ext.name === 'aiAdvanced',
  )

  if (!aiExtension) {
    throw new Error('AI extension not found.')
  }
  const aiExtensionOptions = aiExtension.options // Store for easier access

  const {aiStreamResolver} = aiExtensionOptions
  const recentText =
    (textBlocks.length > 3 ? textBlocks.slice(textBlocks.length - 3) : textBlocks)
      .filter(block => block.node.textContent)
      .map(block => block.node.textContent)
      .join(' ')
      .trimStart() || ''

  const {inputLength, modelName} = autocompletionOptions
  const textForCompletion = recentText
    .slice(Math.max(0, recentText.length - inputLength), recentText.length)
    .trimStart()
  const doc = editor.view.state.doc

  if (!textForCompletion.length) {
    return
  }

  ;(async ({text, aborter}) => {
    let accumulatedText = ''
    try {
      if (aiExtensionOptions.onLoading) {
        aiExtensionOptions.onLoading({action: 'autocomplete', isStreaming: true, editor})
      }

      const stream = await aiStreamResolver({
        editor,
        action: 'autocomplete',
        text,
        textOptions: {modelName},
        extensionOptions: aiExtensionOptions,
        aborter,
        defaultResolver: resolveAiStreamRequest,
      })

      if (!stream) return

      const reader = stream.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const {value: streamValue, done: streamDone} = await reader.read()
        if (streamDone) break // Exit loop when stream is done

        const chunk = decoder.decode(streamValue, {stream: true})
        accumulatedText += chunk

        const decorations = createSuggestionDecorations(
          [textBlocks[textBlocks.length - 1]],
          doc.nodeSize,
          textBlocks[textBlocks.length - 1].node.textContent,
          `${accumulatedText || ''}`,
        )
        const tr = editor.view.state.tr.setMeta('asyncDecorations', decorations)
        editor.view.dispatch(tr)
      }

      if (aiExtensionOptions.onSuccess) {
        aiExtensionOptions.onSuccess({
          action: 'autocomplete',
          isStreaming: true,
          editor,
          response: accumulatedText,
        })
      }
    } catch (error) {
      // Don't report AbortError if it was intentional
      if (error.name === 'AbortError') {
        console.log('Autocompletion fetch aborted.')
        return
      }
      if (aiExtensionOptions.onError) {
        aiExtensionOptions.onError(error, {action: 'autocomplete', isStreaming: true, editor})
      }
    }
  })({text: textForCompletion, aborter: currentAbortController})
}

const AiAutocompletionPlugin = ({
  editor,
  options: pluginOptions,
  pluginKey = 'AiAutocompletionPlugin',
}) => {
  const handleKeyDownForAutocompletion = view => {
    const parentNodeInfo = tiptapCore.findParentNode(node => node.type.name === 'tableCell')(
      editor.state.selection,
    )
    const parentNode =
      parentNodeInfo === null || parentNodeInfo === void 0 ? void 0 : parentNodeInfo.node
    const isTableCell =
      (parentNode === null || parentNode === void 0 ? void 0 : parentNode.type.name) === 'tableCell'

    if (pluginOptions.trigger === 'Tab' && isTableCell) {
      return false
    }

    const cursorPos = editor.state.selection.to
    const textBlocks = tiptapCore.findChildrenInRange(
      view.state.doc,
      {from: 0, to: cursorPos},
      node => node.isTextblock,
    )

    if (!textBlocks.length) return // No text blocks found

    const lastTextBlock = textBlocks[textBlocks.length - 1]
    const lastChildNode = lastTextBlock.node.lastChild
    const lastChildNodeType =
      lastChildNode === null || lastChildNode === void 0 ? void 0 : lastChildNode.type

    if (
      cursorPos === lastTextBlock.pos + lastTextBlock.node.nodeSize - 1 && // Cursor at the very end of the last text block
      (lastTextBlock.node.type.isText ||
        (lastTextBlock.node.type.isTextblock &&
          lastTextBlock.node.childCount !== 0 &&
          (lastChildNodeType === null || lastChildNodeType === void 0
            ? void 0
            : lastChildNodeType.isText)))
    ) {
      triggerAutocompletionFetch(editor, textBlocks, pluginOptions)
    }
  }

  let debounceTimeoutId = null

  return new prosemirrorState.Plugin({
    key: new prosemirrorState.PluginKey(pluginKey),
    state: {
      init: () => prosemirrorView.DecorationSet.empty,
      apply(tr, oldDecorations, oldState, newState) {
        const {docChanged} = tr // `doc` was unused
        const asyncDecorations = tr.getMeta('asyncDecorations')

        if (
          asyncDecorations === undefined &&
          !docChanged &&
          oldState.selection.eq(newState.selection)
        ) {
          return oldDecorations
        }

        if (!oldState.selection.eq(newState.selection)) {
          abortPreviousRequest() // Abort if selection changes
        }
        const mappedDecorations = oldDecorations.map(tr.mapping, tr.doc)
        return prosemirrorView.DecorationSet.create(tr.doc, asyncDecorations || [])
      },
    },
    props: {
      decorations(state) {
        return this.getState(state)
      },
      handleKeyDown(view, event) {
        const currentPluginState = this.getState(view.state)
        const decorationsArray =
          view.state.tr.getMeta('asyncDecorations') ||
          (currentPluginState === null || currentPluginState === void 0
            ? void 0
            : currentPluginState.find()) ||
          []
        const promptDecoration = decorationsArray[0] // Assuming prompt is first if present
        const suggestionDecoration = decorationsArray[1] // Assuming suggestion is second

        const clearDecorations = () => {
          const transaction = view.state.tr.setMeta('asyncDecorations', [])
          // oldDecorations no longer directly available, handled by apply
          view.dispatch(transaction)
        }

        const hasSuggestion = !!suggestionDecoration

        const checkTriggerFunction =
          pluginOptions.checkTrigger ||
          ((_view, keyEvent) => {
            const isTriggerKey = keyEvent.key === pluginOptions.trigger
            if (isTriggerKey && keyEvent.key !== ' ') {
              // Prevent default for non-space triggers
              keyEvent.preventDefault()
              keyEvent.stopPropagation()
            }
            return isTriggerKey
          })

        const shouldTriggerAutocompletion = checkTriggerFunction(view, event)

        if (shouldTriggerAutocompletion) {
          if (event.key === pluginOptions.accept && hasSuggestion) {
            event.preventDefault()
            event.stopPropagation()
            acceptSuggestion(editor.chain(), suggestionDecoration)
            abortPreviousRequest()
            return true
          }
          if (debounceTimeoutId) clearTimeout(debounceTimeoutId)
          debounceTimeoutId = setTimeout(() => {
            handleKeyDownForAutocompletion(view)
          }, pluginOptions.debounce)
          return false // Let other keydown handlers for the trigger key run if not accepting
        }

        switch (event.key) {
          case 'Escape':
            if (hasSuggestion) {
              abortPreviousRequest()
              clearDecorations()
              return true // Handled
            }
            break
          case pluginOptions.accept:
            if (hasSuggestion) {
              event.preventDefault()
              event.stopPropagation()
              acceptSuggestion(editor.chain(), suggestionDecoration)
              abortPreviousRequest()
              return true
            }
            break
          default:
            // If any other key is pressed while a suggestion is active, clear it.
            if (hasSuggestion) {
              abortPreviousRequest()
              clearDecorations()
            }
            if (debounceTimeoutId) clearTimeout(debounceTimeoutId)
            break
        }
        return false // Not handled
      },
    },
  })
}

const AiMark = tiptapCore.Mark.create({
  name: 'aiMark',
  addOptions: () => ({
    HTMLAttributes: {class: 'tiptap-ai-insertion'},
  }),
  parseHTML: () => [
    {
      tag: 'span',
      getAttrs: node =>
        node instanceof HTMLElement && node.classList.contains('tiptap-ai-insertion') && null,
    },
  ],
  renderHTML({HTMLAttributes}) {
    return ['span', tiptapCore.mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },
  addCommands() {
    return {
      setAiMark:
        () =>
        ({commands}) =>
          commands.setMark(this.name),
      toggleAiMark:
        () =>
        ({commands}) =>
          commands.toggleMark(this.name),
      unsetAiMark:
        () =>
        ({commands}) =>
          commands.unsetMark(this.name),
    }
  },
})

const restoreSelectionAfterReplace = ({dispatch, tr, oldSelection}) => {
  if (dispatch) {
    const findLastReplaceStepResolvedPos = ((transaction, minStepIndex, bias) => {
      const lastStepIndex = transaction.steps.length - 1
      if (lastStepIndex < minStepIndex) return -1

      const lastStep = transaction.steps[lastStepIndex]
      if (
        !(
          lastStep instanceof prosemirrorTransform.ReplaceStep ||
          lastStep instanceof prosemirrorTransform.ReplaceAroundStep
        )
      ) {
        return -1
      }
      const mapping = transaction.mapping.maps[lastStepIndex]
      let resolvedPos = 0
      mapping.forEach((_oldStart, _oldEnd, _newStart, newEnd) => {
        if (resolvedPos === 0) resolvedPos = newEnd // Capture the first newEnd
      })
      return prosemirrorState.Selection.near(transaction.doc.resolve(resolvedPos), bias)
    })(tr, tr.steps.length - 1, -1)

    if (findLastReplaceStepResolvedPos !== -1) {
      const newSelection = ((transaction, newResolvedSelection, previousSelection) => {
        const {doc} = transaction
        const docStart = prosemirrorState.TextSelection.atStart(doc).from
        const docEnd = prosemirrorState.TextSelection.atEnd(doc).to
        const from = tiptapCore.minMax(previousSelection.from, docStart, docEnd) // Anchor to old from
        const to = tiptapCore.minMax(newResolvedSelection.to, docStart, docEnd) // Head to new content's end
        return prosemirrorState.TextSelection.create(doc, from, to)
      })(tr, findLastReplaceStepResolvedPos, oldSelection)

      tr.setSelection(newSelection)
      dispatch(tr) // Dispatch should be handled by the caller of command if needed
      return true
    }
  }
  return false
}

const resolveAiCompletionRequest = async ({action, text, textOptions, extensionOptions}) => {
  const {appId, token, baseUrl: configBaseUrl} = extensionOptions
  const baseUrl =
    configBaseUrl !== null && configBaseUrl !== void 0 ? configBaseUrl : AI_DEFAULT_BASE_URL

  const response = await fetch(`${baseUrl}/text/${action}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'X-App-Id': appId,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      html:
        (textOptions === null || textOptions === void 0 ? void 0 : textOptions.format) ===
          'rich-text' || undefined,
      ...textOptions,
      text: text,
    }),
  })
  const responseData = await response.json()

  if (!response.ok) {
    const errorDetail =
      responseData === null || responseData === void 0 ? void 0 : responseData.error
    if (errorDetail instanceof Object) {
      const status = errorDetail === null || errorDetail === void 0 ? void 0 : errorDetail.status
      const message = errorDetail === null || errorDetail === void 0 ? void 0 : errorDetail.message
      throw new Error(`${status} ${message}`)
    }
    const errorMessage =
      responseData === null || responseData === void 0 ? void 0 : responseData.message
    throw new Error(`${errorDetail} ${errorMessage}`)
  }
  return responseData === null || responseData === void 0 ? void 0 : responseData.response
}

const aiCompletionCommand =
  ({props, action, textOptions, extensionOptions, fetchDataFn}) =>
  async () => {
    const {editor} = props
    const {
      state,
      state: {selection},
    } = editor
    const aiStorage = editor.storage.ai || editor.storage.aiAdvanced

    const resolvedTextOptions = {
      collapseToEnd: true,
      format: 'plain-text',
      ...textOptions,
    }

    const {from: initialFrom, to: initialTo} =
      typeof resolvedTextOptions.insertAt === 'number'
        ? {from: resolvedTextOptions.insertAt, to: resolvedTextOptions.insertAt}
        : resolvedTextOptions.insertAt || selection

    const textToProcess =
      (textOptions === null || textOptions === void 0 ? void 0 : textOptions.text) ||
      (resolvedTextOptions.plainText && resolvedTextOptions.format !== 'plain-text'
        ? state.doc.textBetween(initialFrom, initialTo, ' ')
        : getHtmlContentBetween(editor, initialFrom, initialTo))

    const shouldInsert =
      (textOptions === null || textOptions === void 0 ? void 0 : textOptions.insert) !== false
    const shouldAppend = resolvedTextOptions.append && resolvedTextOptions.insertAt === undefined

    if (!textToProcess) {
      return false
    }
    if (textOptions.startsInline === undefined) {
      // Ensure this is set if not provided
      textOptions.startsInline = isSelectionSpanningMultipleBlocks(selection)
    }

    Object.assign(aiStorage, {
      state: 'loading',
      response: '', // Clear previous response
      error: undefined,
      generatedWith: {options: textOptions, action: action, range: undefined},
    })
    editor.chain().setMeta('aiResponse', aiStorage).run()

    if (extensionOptions.onLoading) {
      extensionOptions.onLoading({editor, action, isStreaming: false})
    }

    const insertAtPos = shouldAppend ? initialTo : initialFrom

    return editor.commands.streamContent(
      // Even for non-stream, use this for consistent update logic
      shouldAppend ? initialTo : {from: initialFrom, to: initialTo},
      async ({write}) => {
        try {
          const responseText = await fetchDataFn({
            editor,
            action,
            text: textToProcess,
            textOptions, // Pass original textOptions for the API
            extensionOptions,
            defaultResolver: resolveAiCompletionRequest,
          })

          if (responseText === undefined || responseText === null) {
            // Check if response is empty
            Object.assign(aiStorage, {state: 'idle', error: new Error('Empty response from AI.')})
            editor.chain().setMeta('aiResponse', aiStorage).run()
            if (extensionOptions.onError) {
              extensionOptions.onError(aiStorage.error, {editor, action, isStreaming: false})
            }
            return false
          }

          Object.assign(aiStorage, {
            // Initial update before potential insertion
            state: 'idle',
            response: responseText, // Store the actual response here
            error: undefined,
          })
          // Do not set generatedWith.range yet, it's set after successful insertion

          aiStorage.pastResponses.push(responseText) // Add to history

          if (shouldInsert) {
            const oldSelectionForRestore = {from: initialFrom, to: initialTo}
            const writeResult = write({
              partial: responseText, // Treat whole response as one "partial" chunk
              appendToChain: chain =>
                chain
                  .setMeta('aiResponse', aiStorage) // Ensure aiStorage is up-to-date in meta
                  .command(({dispatch, tr}) =>
                    restoreSelectionAfterReplace({
                      dispatch,
                      tr,
                      oldSelection: oldSelectionForRestore,
                    }),
                  ),
            })
            // After successful write, update generatedWith with the actual range
            if (aiStorage.generatedWith) {
              aiStorage.generatedWith.range = {from: writeResult.from, to: writeResult.to}
            }
          } else {
            // If not inserting, still update meta with the response available for manual accept
            editor.chain().setMeta('aiResponse', aiStorage).run()
          }
          // Final state update after all operations
          Object.assign(aiStorage, {
            state: 'idle',
            response: responseText, // Ensure response is still set
            // generatedWith might have been updated with range if inserted
          })

          if (extensionOptions.onSuccess) {
            extensionOptions.onSuccess({editor, action, isStreaming: false, response: responseText})
          }
          // Final meta update if not inserting, or if further changes to aiStorage happened
          editor.chain().setMeta('aiResponse', aiStorage).run()
          return true
        } catch (error) {
          Object.assign(aiStorage, {
            state: 'error',
            response: undefined,
            error: error,
            generatedWith: {options: textOptions, action, range: undefined}, // Reset on error
          })
          editor.chain().setMeta('aiResponse', aiStorage).run()
          if (extensionOptions.onError) {
            extensionOptions.onError(error, {editor, action, isStreaming: false})
          }
          return false
        }
      },
    )
    return true
  }

const resolveAiImageRequest = async ({text, imageOptions, extensionOptions}) => {
  const {appId, token, baseUrl: configBaseUrl} = extensionOptions
  const baseUrl =
    configBaseUrl !== null && configBaseUrl !== void 0 ? configBaseUrl : AI_DEFAULT_BASE_URL

  const response = await fetch(`${baseUrl}/image/prompt`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'X-App-Id': appId,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({...imageOptions, text}),
  })

  if (!response.ok) {
    const errorData = await response.json()
    const errorDetail = errorData === null || errorData === void 0 ? void 0 : errorData.error
    if (errorDetail instanceof Object) {
      const status = errorDetail === null || errorDetail === void 0 ? void 0 : errorDetail.status
      const message = errorDetail === null || errorDetail === void 0 ? void 0 : errorDetail.message
      throw new Error(`${status} ${message}`)
    }
    const errorMessage = errorData === null || errorData === void 0 ? void 0 : errorData.message
    throw new Error(`${errorDetail} ${errorMessage}`)
  }
  const responseData = await response.json()
  return responseData === null || responseData === void 0 ? void 0 : responseData.response
}

const aiImageCommand =
  ({props, imageOptions, extensionOptions, fetchDataFn}) =>
  async () => {
    const {editor} = props
    const {state} = editor
    const {
      selection: {from, to},
    } = state

    const textFromOptions =
      imageOptions === null || imageOptions === void 0 ? void 0 : imageOptions.text
    const textForImage =
      textFromOptions !== null && textFromOptions !== void 0
        ? textFromOptions
        : state.doc.textBetween(from, to, ' ')

    if (extensionOptions.onLoading) {
      extensionOptions.onLoading({action: 'image', isStreaming: false, editor})
    }

    try {
      const imageUrl = await fetchDataFn({
        editor,
        text: textForImage,
        imageOptions,
        extensionOptions,
      })
      if (!imageUrl) {
        // Handle case where image URL might be empty/null
        throw new Error('Received empty image URL from AI service.')
      }
      editor.chain().focus().setImage({src: imageUrl, alt: textForImage, title: textForImage}).run()

      if (extensionOptions.onSuccess) {
        extensionOptions.onSuccess({
          action: 'image',
          isStreaming: false,
          editor,
          response: imageUrl,
        })
      }
      return true
    } catch (error) {
      if (extensionOptions.onError) {
        extensionOptions.onError(error, {action: 'image', isStreaming: false, editor})
      }
      return false
    }
  }

const dispatchAiTextAction = (commandProps, action, textActionOptions) => {
  const {editor} = commandProps
  const {stream = false} = textActionOptions // Default to non-streaming if not specified
  const aiExtension = editor.extensionManager.extensions.find(
    ext => ext.name === 'ai' || ext.name === 'aiAdvanced',
  )
  // Ensure aiStorage is fetched after confirming aiExtension exists
  if (!aiExtension) {
    console.error('[tiptap-ai] AI extension not found.')
    return false
  }
  const aiStorage = editor.storage.ai || editor.storage.aiAdvanced

  if (aiStorage.state === 'loading') {
    console.warn('[tiptap-ai] AI is already processing a request.')
    return false
  }

  const {baseUrl} = aiExtension.options

  if (
    typeof window !== 'undefined' &&
    ![
      'localhost',
      '127.0.0.1',
      'tiptap.dev', // Add actual production domains if any
      'embed-pro.tiptap.dev',
      'ai-demo.tiptap.dev',
      'demos.tiptap.dev',
      'demo-pitch.tiptap.dev',
    ].includes(window.location.hostname) &&
    baseUrl === AI_DEMO_BASE_URL
  ) {
    console.warn(
      '[tiptap-ai] You’re using our demo AI endpoint. This is highly discouraged in your own projects and may break things.\n\nPlease register an account at https://tiptap.dev',
    )
  }
  const resolverFn = stream ? resolveAiStreamRequest : resolveAiCompletionRequest
  const commandFn = stream ? aiStreamCommand : aiCompletionCommand

  commandFn({
    props: commandProps,
    action,
    textOptions: textActionOptions,
    extensionOptions: aiExtension.options,
    fetchDataFn: resolverFn,
  })() // Invoke the command
  return true
}

function getFragmentContentDepth(fragment, preferFirstChild) {
  if (!fragment) return -1
  const childNode = preferFirstChild ? fragment.firstChild : fragment.lastChild
  const childContent = childNode === null || childNode === void 0 ? void 0 : childNode.content
  return 1 + getFragmentContentDepth(childContent, preferFirstChild)
}

const StreamContentPluginKey = new prosemirrorState.PluginKey('streamContent')
let streamTransactionListeners = []

const StreamContentExtension = tiptapCore.Extension.create({
  name: 'streamContent',
  onTransaction({transaction}) {
    // Avoid modifying listeners array while iterating
    const currentListeners = [...streamTransactionListeners]
    currentListeners.forEach(listener => listener(transaction))
  },
  addCommands() {
    return {
      streamContent:
        (rangeOrPosition, streamHandlerFn, streamOptions) =>
        ({editor}) => {
          const respondInline =
            (streamOptions === null || streamOptions === void 0
              ? void 0
              : streamOptions.respondInline) !== false // Default true
          const streamStartTime = Date.now()
          let fromPos = -1,
            toPos = -1

          if (typeof rangeOrPosition === 'number') {
            fromPos = rangeOrPosition
            toPos = rangeOrPosition
          } else if (rangeOrPosition && 'from' in rangeOrPosition && 'to' in rangeOrPosition) {
            fromPos = rangeOrPosition.from
            toPos = rangeOrPosition.to
          }

          const isCollapsedSelection = fromPos === toPos
          if (fromPos === -1 || toPos === -1) return false

          let currentFragmentSize = 0
          const contentAccumulator = ContentAccumulator.create()
          const mapping = new prosemirrorTransform.Mapping()

          function transactionListenerForStream(transaction) {
            const metaForStream = transaction.getMeta(StreamContentPluginKey)
            if (
              !transaction.docChanged ||
              (metaForStream !== undefined && metaForStream.startTime === streamStartTime)
            ) {
              // No mapping if change is from this stream or no doc change
            } else {
              mapping.appendMapping(transaction.mapping)
            }
          }
          streamTransactionListeners.push(transactionListenerForStream)

          const defaultTransformFragment = transformInput =>
            prosemirrorModel.Fragment.from(
              tiptapCore.createNodeFromContent(
                transformInput.buffer,
                transformInput.editor.state.schema,
                {
                  parseOptions: (streamOptions === null || streamOptions === void 0
                    ? void 0
                    : streamOptions.parseOptions) || {preserveWhitespace: 'full'}, // preserveWhitespace: false can strip spaces
                },
              ),
            )

          ;(async () => {
            const streamControls = {
              cleanup() {
                const initialLength = streamTransactionListeners.length
                streamTransactionListeners = streamTransactionListeners.filter(
                  listener => listener !== transactionListenerForStream,
                )
                // Finalize only if this specific listener was removed
                if (streamTransactionListeners.length === initialLength - 1) {
                  contentAccumulator.finalize()
                  editor
                    .chain()
                    .setMeta(StreamContentPluginKey, {
                      startTime: streamStartTime,
                      partial: contentAccumulator.lastPartial,
                      buffer: contentAccumulator.content,
                      done: true,
                    })
                    .run()
                }
              },
              write({
                partial: partialContent,
                transform: transformFn = defaultTransformFragment,
                appendToChain: chainAppender = chain => chain,
              }) {
                let chain = editor.chain()
                if (contentAccumulator.content === '' && !isCollapsedSelection) {
                  chain = chain.deleteRange({from: fromPos, to: toPos})
                }
                contentAccumulator.append(partialContent)

                chain = chain
                  .setMeta(StreamContentPluginKey, {
                    startTime: streamStartTime,
                    partial: contentAccumulator.lastPartial,
                    buffer: contentAccumulator.content,
                    done: false, // Not done until cleanup
                  })
                  .setMeta('preventClearDocument', true)

                const fragmentToInsert = prosemirrorModel.Fragment.from(
                  transformFn({
                    partial: contentAccumulator.lastPartial,
                    buffer: contentAccumulator.content,
                    editor,
                    defaultTransform: customBuffer =>
                      defaultTransformFragment({
                        buffer: customBuffer || contentAccumulator.content,
                        partial: partialContent,
                        editor,
                      }),
                  }),
                )

                let isFragmentInvalid = false
                try {
                  fragmentToInsert.forEach(node => {
                    node.check()
                  })
                } catch (err) {
                  isFragmentInvalid = true
                  console.error('Invalid fragment:', err, fragmentToInsert.toJSON())
                }

                const isFragmentEffectivelyEmpty = (frag => {
                  let isEmpty = true
                  frag.forEach(node => {
                    if (isEmpty) {
                      isEmpty = tiptapCore.isNodeEmpty(node, {
                        checkChildren: true,
                        ignoreWhitespace: true, // Consider if whitespace-only should be empty
                      })
                    }
                  })
                  return isEmpty
                })(fragmentToInsert)

                if (isFragmentEffectivelyEmpty || isFragmentInvalid) {
                  chain.run() // Run chain to set meta
                  return {
                    buffer: contentAccumulator.content,
                    from: mapping.map(fromPos),
                    to: mapping.map(fromPos) + currentFragmentSize, // Use previous size
                  }
                }

                const firstChildOfFragment = fragmentToInsert.firstChild
                const isFirstChildText =
                  (firstChildOfFragment === null || firstChildOfFragment === void 0
                    ? void 0
                    : firstChildOfFragment.isText) || false
                const maxDocSize = editor.state.doc.nodeSize - 2

                let mappedFrom = tiptapCore.minMax(
                  mapping.map(fromPos, 1),
                  isFirstChildText ? 1 : 0,
                  maxDocSize,
                )
                const mappedTo = tiptapCore.minMax(mappedFrom + currentFragmentSize, 0, maxDocSize)

                if (
                  mappedFrom === 1 &&
                  !isFirstChildText &&
                  editor.state.doc.nodeAt(0)?.type.name === 'doc'
                ) {
                  mappedFrom = 0
                }

                let newRange = {from: mappedFrom, to: mappedTo}

                chain = chain.command(({tr}) => {
                  const sliceDepth = respondInline
                    ? Math.min(
                        tr.doc.resolve(mappedFrom).depth,
                        getFragmentContentDepth(fragmentToInsert, true),
                      )
                    : 0
                  tr.replaceRange(
                    mappedFrom,
                    mappedTo,
                    new prosemirrorModel.Slice(fragmentToInsert, sliceDepth, 0),
                  )
                  const lastStep = tr.steps[tr.steps.length - 1]
                  if (
                    lastStep &&
                    (lastStep instanceof prosemirrorTransform.ReplaceStep ||
                      lastStep instanceof prosemirrorTransform.ReplaceAroundStep)
                  ) {
                    newRange = {from: lastStep.from, to: lastStep.from + lastStep.slice.size}
                  }
                  return true
                })

                chain = chainAppender(chain)
                currentFragmentSize = fragmentToInsert.size
                chain.run()

                return {
                  buffer: contentAccumulator.content,
                  from: newRange.from,
                  to: newRange.to,
                }
              },
            }

            try {
              await streamHandlerFn({
                write: streamControls.write,
                getWritableStream() {
                  const textDecoder = new TextDecoder('utf-8')
                  return new WritableStream({
                    write: chunkValue =>
                      new Promise(resolveWrite => {
                        const decodedChunk = textDecoder.decode(chunkValue, {stream: true})
                        streamControls.write({partial: decodedChunk})
                        resolveWrite()
                      }),
                    close() {
                      streamControls.cleanup()
                    },
                  })
                },
              })
            } finally {
              streamControls.cleanup() // Ensure cleanup happens
            }
          })()
          return true
        },
    }
  },
})

const AiExtension = tiptapCore.Extension.create({
  name: 'ai',
  addStorage: () => ({
    pastResponses: [],
    state: 'idle',
    response: undefined,
    error: undefined,
    generatedWith: undefined,
  }),

  addOptions: () => ({
    appId: 'YOUR_APP_ID',
    token: 'YOUR_TOKEN_HERE',
    baseUrl: AI_DEFAULT_BASE_URL,
    autocompletion: false,
    autocompletionOptions: {
      inputLength: 4000,
      trigger: 'Tab',
      modelName: undefined,
      checkTrigger: undefined,
      accept: undefined, // Will default to trigger or "Tab"
      debounce: 0,
    },
    append: false,
    collapseToEnd: true,
    aiStreamResolver: resolveAiStreamRequest,
    aiCompletionResolver: resolveAiCompletionRequest,
    aiImageResolver: resolveAiImageRequest,
    onLoading: () => null,
    onSuccess: () => null,
    onError: () => null,
    showDecorations: true,
  }),

  addExtensions: () => [AiMark.configure(), StreamContentExtension.configure()],

  addProseMirrorPlugins() {
    const plugins = []

    if (this.editor.options.injectCSS) {
      tiptapCore.createStyleTag(
        `
                .tiptap-ai-suggestion { /* Applied to the node decoration */
                  /* position: relative; */ /* If needed for complex ::after styling */
                }
                .tiptap-ai-suggestion::after {
                  content: attr(data-suggestion);
                  color: #6B7280; /* Tailwind gray-500 */
                  pointer-events: none; /* Allows interaction with text underneath */
                  /* white-space: pre-wrap; */ /* If suggestions can have newlines */
                }
                .tiptap-ai-prompt { /* Applied to inline decoration for the prompt text */
                  /* Optional styling for the prompt itself, e.g., background */
                }
                .tiptap-ai-suggestion br:first-child,
                .tiptap-ai-suggestion br:last-child {
                  content: ' ';
                  display: inline;
                }
                `,
        this.editor.options.injectNonce,
        'ai', // CSS group key
      )
    }

    if (this.options.autocompletion) {
      const extOptions = this.options // Alias for extension options
      const acOptions = extOptions.autocompletionOptions || {} // Ensure autocompletionOptions exists

      const finalAcceptKey =
        acOptions.accept !== null && acOptions.accept !== undefined
          ? acOptions.accept
          : acOptions.trigger !== null && acOptions.trigger !== undefined
            ? acOptions.trigger
            : 'Tab'

      plugins.push(
        AiAutocompletionPlugin({
          editor: this.editor,
          options: {
            // Pass resolved options to the plugin
            appId: extOptions.appId,
            token: extOptions.token,
            baseUrl: extOptions.baseUrl || AI_DEFAULT_BASE_URL,
            inputLength: acOptions.inputLength || 4000,
            modelName: acOptions.modelName,
            trigger: acOptions.trigger || 'Tab',
            checkTrigger: acOptions.checkTrigger,
            accept: finalAcceptKey,
            debounce: acOptions.debounce || 0,
          },
        }),
      )
    }
    return plugins
  },

  addCommands: () => ({
    aiAdjustTone:
      (tone, options = {}) =>
      props =>
        dispatchAiTextAction(props, 'adjust-tone', {...options, tone}),
    aiBloggify:
      (options = {}) =>
      props =>
        dispatchAiTextAction(props, 'bloggify', options),
    aiComplete:
      (options = {append: true}) =>
      props =>
        dispatchAiTextAction(props, 'complete', options),
    aiDeEmojify:
      (options = {}) =>
      props =>
        dispatchAiTextAction(props, 'de-emojify', options),
    aiExtend:
      (options = {}) =>
      props =>
        dispatchAiTextAction(props, 'extend', options),
    aiEmojify:
      (options = {}) =>
      props =>
        dispatchAiTextAction(props, 'emojify', options),
    aiFixSpellingAndGrammar:
      (options = {}) =>
      props =>
        dispatchAiTextAction(props, 'fix-spelling-and-grammar', options),
    aiRephrase:
      (options = {}) =>
      props =>
        dispatchAiTextAction(props, 'rephrase', options),
    aiShorten:
      (options = {}) =>
      props =>
        dispatchAiTextAction(props, 'shorten', options),
    aiSimplify:
      (options = {}) =>
      props =>
        dispatchAiTextAction(props, 'simplify', options),
    aiSummarize:
      (options = {}) =>
      props =>
        dispatchAiTextAction(props, 'summarize', options),
    aiKeypoints:
      (options = {}) =>
      props =>
        dispatchAiTextAction(props, 'keypoints', options),
    aiTextPrompt:
      (options = {}) =>
      props =>
        dispatchAiTextAction(props, 'prompt', options),
    aiTldr:
      (options = {}) =>
      props =>
        dispatchAiTextAction(props, 'tldr', options),
    aiTranslate:
      (language, options = {}) =>
      props =>
        dispatchAiTextAction(props, 'translate', {...options, language}),
    aiRestructure:
      (options = {}) =>
      props =>
        dispatchAiTextAction(props, 'restructure', options),

    aiImagePrompt:
      (imagePromptOptions = {}) =>
      cmdProps => {
        const {editor, state: editorState} = cmdProps
        const aiExtensionInstance = editor.extensionManager.extensions.find(
          ext => ext.name === 'ai' || ext.name === 'aiAdvanced',
        )
        if (!aiExtensionInstance) {
          console.error('[tiptap-ai] AI extension not found for image prompt.')
          return false
        }

        const {
          selection: {from, to},
        } = editorState
        const textFromOptions =
          imagePromptOptions === null || imagePromptOptions === void 0
            ? void 0
            : imagePromptOptions.text
        const textForImage =
          textFromOptions !== null && textFromOptions !== undefined
            ? textFromOptions
            : editorState.doc.textBetween(from, to, ' ')

        const imageExtension = editor.extensionManager.extensions.find(ext => ext.name === 'image')

        if (!textForImage && !imagePromptOptions.text) {
          // No text provided or selected
          console.warn('[tiptap-ai] No text provided for image prompt.')
          return false
        }
        if (!imageExtension) {
          throw new Error('[tiptap-ai] Image extension is not loaded, cannot run aiImagePrompt.')
        }

        aiImageCommand({
          props: cmdProps,
          imageOptions: imagePromptOptions, // Contains text if provided
          extensionOptions: aiExtensionInstance.options,
          fetchDataFn: aiExtensionInstance.options.aiImageResolver,
        })()
        return true
      },

    aiAccept:
      ({insertAt, append} = {}) =>
      ({dispatch, editor, chain}) => {
        const aiStorage = editor.storage.ai || editor.storage.aiAdvanced

        const generatedWithData =
          aiStorage === null || aiStorage === void 0 ? void 0 : aiStorage.generatedWith
        const generatedWithOptions =
          generatedWithData === null || generatedWithData === void 0
            ? void 0
            : generatedWithData.options
        const generatedWithRange =
          generatedWithData === null || generatedWithData === void 0
            ? void 0
            : generatedWithData.range

        const {from: selectionFrom, to: selectionTo} =
          typeof insertAt === 'number'
            ? {from: insertAt, to: insertAt}
            : insertAt || editor.state.selection

        let effectiveAppend = append
        if (effectiveAppend === null || effectiveAppend === undefined) {
          effectiveAppend =
            typeof insertAt === 'number'
              ? false
              : generatedWithOptions
                ? generatedWithOptions.append
                : false
        }

        if (
          aiStorage.state === 'loading' ||
          aiStorage.state === 'error' ||
          aiStorage.response === undefined ||
          generatedWithRange // If range exists, it implies content was already inserted by stream/completion command
        ) {
          return false
        }

        if (dispatch) {
          const {response: responseText} = aiStorage
          Object.assign(aiStorage, {
            // Reset state before insertion
            state: 'idle',
            response: undefined, // Clear response as it's being inserted
            error: undefined,
            generatedWith: undefined, // Clear generatedWith as we are accepting it
          })
          aiStorage.pastResponses = []

          chain()
            .setMeta('aiResponse', {...aiStorage}) // Pass a copy of the reset storage
            .focus()
            .insertContentAt(
              effectiveAppend ? selectionTo : {from: selectionFrom, to: selectionTo},
              responseText,
              {
                parseOptions: {preserveWhitespace: false},
                errorOnInvalidContent: false, // Be lenient with pasted HTML-like content
              },
            )
            .run()
        }
        return true
      },

    aiReject:
      ({type = 'reset'} = {}) =>
      ({dispatch, editor, chain}) => {
        const aiStorage = editor.storage.ai || editor.storage.aiAdvanced
        const generatedWithData =
          aiStorage === null || aiStorage === void 0 ? void 0 : aiStorage.generatedWith
        const generatedWithRange =
          generatedWithData === null || generatedWithData === void 0
            ? void 0
            : generatedWithData.range

        if (
          aiStorage.state === 'error' || // Allow rejecting error state
          aiStorage.response === undefined ||
          generatedWithRange // If already inserted, reject shouldn't do much unless it's a reset
        ) {
          if (type === 'reset' && generatedWithRange) {
            // If it was inserted and we reset, it's up to user to delete content
            // This command only resets the AI state
          } else {
            return false
          }
        }

        if (dispatch) {
          if (type === 'reset') {
            Object.assign(aiStorage, {
              state: 'idle',
              response: undefined,
              error: undefined,
              generatedWith: undefined,
            })
            aiStorage.pastResponses = []
          } else if (type === 'pause') {
            // Keep response, set state to idle
            Object.assign(aiStorage, {state: 'idle'})
          }
          chain()
            .setMeta('aiResponse', {...aiStorage})
            .run() // Pass a copy
        }
        return true
      },

    aiRegenerate:
      ({insert, insertAt} = {}) =>
      props => {
        const {dispatch, editor} = props
        const aiStorage = editor.storage.ai || editor.storage.aiAdvanced

        if (aiStorage.pastResponses.length === 0 || !aiStorage.generatedWith) {
          return false // Nothing to regenerate from
        }

        const originalGeneratedWith = aiStorage.generatedWith
        const originalAction = originalGeneratedWith.action
        let optionsForRegeneration = {...originalGeneratedWith.options} // Copy original options

        // Determine if the regenerated content should be inserted and where
        const shouldInsert =
          insert !== undefined ? insert : originalGeneratedWith.range !== undefined
        let newInsertAt = insertAt
        if (shouldInsert && newInsertAt === undefined && originalGeneratedWith.range) {
          newInsertAt = originalGeneratedWith.range // Use previous insertion range
        }

        if (shouldInsert) {
          optionsForRegeneration.insert = true
          if (newInsertAt !== undefined) {
            optionsForRegeneration.insertAt = newInsertAt
          } else {
            // Cannot insert without a specific range/position
            console.warn(
              '[tiptap-ai] Cannot regenerate with insert: true without a range or insertAt position.',
            )
            return false
          }
        } else {
          // If not inserting, ensure these are not carried over
          delete optionsForRegeneration.insert
          delete optionsForRegeneration.insertAt
        }

        if (dispatch) {
          // Clear previous response from immediate storage before new call, but keep pastResponses for history
          Object.assign(aiStorage, {
            response: undefined,
            error: undefined,
            // Keep generatedWith for a moment for the dispatchAiTextAction to use, it will be overwritten
          })
          return dispatchAiTextAction(props, originalAction, optionsForRegeneration)
        }
        return false
      },
  }),
})

exports.AI_DEFAULT_BASE_URL = AI_DEFAULT_BASE_URL
exports.AI_DEMO_BASE_URL = AI_DEMO_BASE_URL
exports.Ai = AiExtension
exports.StreamContent = StreamContentExtension
exports.StreamContentPluginKey = StreamContentPluginKey
exports.aiCompletionCommand = aiCompletionCommand
exports.aiImageCommand = aiImageCommand
exports.aiStreamCommand = aiStreamCommand
exports.default = AiExtension
exports.getHTMLContentBetween = getHtmlContentBetween
exports.resolveAiCompletion = resolveAiCompletionRequest
exports.resolveAiImage = resolveAiImageRequest
exports.resolveAiStream = resolveAiStreamRequest
exports.tryParseToTiptapHTML = function (content, editorContext) {
  try {
    let nodeOrFragment = tiptapCore.createNodeFromContent(content, editorContext.schema, {
      parseOptions: {preserveWhitespace: 'full'}, // Changed to "full"
    })
    // createNodeFromContent can return a Node (e.g. doc) or a Fragment
    // getHTMLFromFragment expects a Fragment. If it's a Doc node, use its content.
    if (
      nodeOrFragment instanceof prosemirrorModel.Node &&
      nodeOrFragment.type.name === editorContext.schema.topNodeType.name
    ) {
      nodeOrFragment = nodeOrFragment.content
    }
    return tiptapCore.getHTMLFromFragment(nodeOrFragment, editorContext.schema)
  } catch (error) {
    console.error('Error in tryParseToTiptapHTML:', error)
    return null // Return null on error as per original logic
  }
}
