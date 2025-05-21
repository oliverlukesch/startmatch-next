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

  // If selection doesn't span multiple blocks, remove the outer tag
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
  var _a, _b
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
    if ((errorData === null || errorData === void 0 ? void 0 : errorData.error) instanceof Object) {
      throw new Error(
        `${(_a = errorData === null || errorData === void 0 ? void 0 : errorData.error) === null || _a === void 0 ? void 0 : _a.status} ${(_b = errorData === null || errorData === void 0 ? void 0 : errorData.error) === null || _b === void 0 ? void 0 : _b.message}`,
      )
    }
    throw new Error(
      `${errorData === null || errorData === void 0 ? void 0 : errorData.error} ${errorData === null || errorData === void 0 ? void 0 : errorData.message}`,
    )
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
  ({
    props,
    action,
    textOptions,
    extensionOptions,
    fetchDataFn, // Renamed from 'r'
  }) =>
  async () => {
    var _a
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
    ;(_a = extensionOptions.onLoading) === null ||
      _a === void 0 ||
      _a.call(extensionOptions, {editor, action, isStreaming: true})

    const decoder = new TextDecoder('utf-8')
    const contentAccumulator = ContentAccumulator.create()

    // If inserting at a specific point in plain text and it's not a paragraph, create one
    if (from === to && resolvedTextOptions.format === 'plain-text' && !editor.$pos(to).parent) {
      editor.chain().setTextSelection(to).createParagraphNear().run()
      from += 1
      to += 1
    }

    let currentInsertFrom = from
    let currentInsertTo = to

    return editor.commands.streamContent(shouldAppend ? to : {from, to}, async ({write}) => {
      var _b, _c, _d
      try {
        const stream = await fetchDataFn({
          // `WorkspaceDataFn` was `r`
          editor,
          action,
          text: textToProcess,
          textOptions: resolvedTextOptions,
          extensionOptions,
          defaultResolver: resolveAiStreamRequest, // Was `c`
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

          if (aiStorage.state === 'idle') return false // Streaming was cancelled

          Object.assign(aiStorage, {
            state: 'loading',
            response: contentAccumulator.content,
            error: undefined,
            generatedWith: {options: textOptions, action, range: undefined},
          })
          ;(_b = extensionOptions.onChunk) === null ||
            _b === void 0 ||
            _b.call(extensionOptions, {
              editor,
              action,
              isStreaming: true,
              chunk: contentAccumulator.lastPartial,
              response: contentAccumulator.content,
            })

          try {
            if (shouldInsert) {
              ;({from: currentInsertFrom, to: currentInsertTo} = write({
                partial: chunkText, // This was `p` (parameter name)
                transform: ({defaultTransform}) =>
                  extensionOptions.showDecorations === false
                    ? defaultTransform()
                    : tiptapCore.createNodeFromContent(
                        addAiMarkToContentNodes(defaultTransform().toJSON()),
                        editor.schema,
                      ),
                appendToChain: chain => chain.setMeta('aiResponse', aiStorage),
              }))
            } else {
              editor.chain().setMeta('aiResponse', aiStorage).run()
            }
          } catch (err) {
            if (err instanceof Error && err.message.startsWith('Invalid content for node')) {
              // Skip this chunk if it's invalid for the node, but continue streaming
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
          generatedWith: {options: textOptions, action, range: undefined},
        })
        aiStorage.pastResponses.push(contentAccumulator.content)
        ;(_c = extensionOptions.onSuccess) === null ||
          _c === void 0 ||
          _c.call(extensionOptions, {
            editor,
            action,
            isStreaming: true,
            response: contentAccumulator.content,
          })

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
            collapseToEnd ? currentInsertTo : {from, to: currentInsertTo},
          )
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
        ;(_d = extensionOptions.onError) === null ||
          _d === void 0 ||
          _d.call(extensionOptions, error, {editor, action, isStreaming: true})
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

const createSuggestionDecorations = (nodesToDecorate, docNodeSize, promptText, suggestionText) => {
  return nodesToDecorate
    .map(nodeInfo => [
      prosemirrorView.Decoration.inline(nodeInfo.pos, nodeInfo.pos + nodeInfo.node.nodeSize, {
        class: 'tiptap-ai-prompt', // Assuming this class is desired, though not explicitly used in logic
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
  }
}

const triggerAutocompletionFetch = async (editor, textBlocks, autocompletionOptions) => {
  currentAbortController = new AbortController()
  const aiExtension = editor.extensionManager.extensions.find(
    ext => ext.name === 'ai' || ext.name === 'aiAdvanced',
  )

  if (!aiExtension) {
    throw new Error('AI extension not found.')
  }

  const {aiStreamResolver} = aiExtension.options
  const recentText =
    (textBlocks.length > 3 ? textBlocks.slice(textBlocks.length - 3) : textBlocks)
      .filter(block => block.node.textContent)
      .map(block => block.node.textContent)
      .join(' ')
      .trimStart() || ''

  const {inputLength, modelName} = autocompletionOptions
  const textForCompletion = recentText
    .slice(recentText.length - inputLength, recentText.length)
    .trimStart()
  const doc = editor.view.state.doc

  if (!textForCompletion.length) {
    return
  }

  ;(async ({text, aborter}) => {
    var _a, _b, _c, _d, _e, _f
    let accumulatedText = ''
    try {
      ;(_b = (_a = aiExtension.options).onLoading) === null ||
        _b === void 0 ||
        _b.call(_a, {action: 'autocomplete', isStreaming: true, editor})

      const stream = await aiStreamResolver({
        editor,
        action: 'autocomplete',
        text,
        textOptions: {modelName},
        extensionOptions: aiExtension.options,
        aborter,
        defaultResolver: resolveAiStreamRequest,
      })

      if (!stream) return

      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let isDone = false

      while (!isDone) {
        const {value: streamValue, done: streamDone} = await reader.read()
        const chunk = decoder.decode(streamValue, {stream: true})
        isDone = streamDone
        accumulatedText += chunk

        const decorations = createSuggestionDecorations(
          [textBlocks[textBlocks.length - 1]],
          doc.nodeSize, // docNodeSize was 'e' (second param to createSuggestionDecorations)
          textBlocks[textBlocks.length - 1].node.textContent,
          `${accumulatedText || ''}`,
        )
        const tr = editor.view.state.tr.setMeta('asyncDecorations', decorations)
        editor.view.dispatch(tr)
      }
      isDone = true // Explicitly set after loop, though `while(!isDone)` covers it.
      ;(_d = (_c = aiExtension.options).onSuccess) === null ||
        _d === void 0 ||
        _d.call(_c, {action: 'autocomplete', isStreaming: true, editor, response: accumulatedText})
    } catch (error) {
      ;(_f = (_e = aiExtension.options).onError) === null ||
        _f === void 0 ||
        _f.call(_e, error, {action: 'autocomplete', isStreaming: true, editor})
    }
  })({text: textForCompletion, aborter: currentAbortController})
}

const AiAutocompletionPlugin = ({editor, options, pluginKey = 'AiAutocompletionPlugin'}) => {
  const handleKeyDownForAutocompletion = view => {
    // Was 'r'
    var _a, _b
    const isTableCell = // Was 'r' (inner variable)
      (currentEditor => {
        // Was 'e' (parameter to inner func)
        var _a
        return (_a = tiptapCore.findParentNode(node => node.type.name === 'tableCell')(
          currentEditor.state.selection,
        )) === null || _a === void 0
          ? void 0
          : _a.node
      })(editor)?.type.name === 'tableCell'

    if (options.trigger === 'Tab' && isTableCell) {
      return false // Don't interfere with table navigation
    }

    const cursorPos = editor.state.selection.to
    const textBlocks = tiptapCore.findChildrenInRange(
      view.state.doc,
      {from: 0, to: cursorPos},
      node => node.isTextblock,
    )
    const lastTextBlock = textBlocks[textBlocks.length - 1]

    // Condition to trigger autocompletion (e.g. at the end of a text node in a text block)
    if (
      cursorPos === lastTextBlock.pos + lastTextBlock.node.nodeSize - 1 &&
      (lastTextBlock.node.type.isText ||
        (lastTextBlock.node.type.isTextblock &&
          lastTextBlock.node.childCount !== 0 &&
          ((_b =
            (_a = lastTextBlock.node.lastChild) === null || _a === void 0 ? void 0 : _a.type) ===
            null || _b === void 0
            ? void 0
            : _b.isText)))
    ) {
      triggerAutocompletionFetch(editor, textBlocks, options)
    }
  }

  let debounceTimeoutId = null

  return new prosemirrorState.Plugin({
    key: new prosemirrorState.PluginKey(pluginKey),
    state: {
      init: () => prosemirrorView.DecorationSet.empty,
      apply(tr, oldDecorations, oldState, newState) {
        const {doc, docChanged} = tr
        const asyncDecorations = tr.getMeta('asyncDecorations')

        if (
          asyncDecorations === undefined &&
          !docChanged &&
          oldState.selection.eq(newState.selection)
        ) {
          return oldDecorations
        }

        if (!oldState.selection.eq(newState.selection)) {
          abortPreviousRequest()
        }
        const mappedDecorations = oldDecorations.map(tr.mapping, tr.doc)
        return prosemirrorView.DecorationSet.create(doc, asyncDecorations || [])
      },
    },
    props: {
      decorations(state) {
        return this.getState(state)
      },
      handleKeyDown(view, event) {
        var _a
        const decorations = this.getState(view.state)
        const [promptDecoration, suggestionDecoration] = // promptDecoration was 'l', suggestionDecoration was 'c'
          view.state.tr.getMeta('asyncDecorations') ||
          (decorations === null || decorations === void 0 ? void 0 : decorations.find()) ||
          []

        const clearDecorations = () => {
          const tr = view.state.tr.setMeta('asyncDecorations', [])
          if (decorations) {
            decorations.remove([promptDecoration])
            decorations.remove([suggestionDecoration])
          }
          view.dispatch(tr)
        }

        const hasSuggestion = !!promptDecoration // was 'p'

        const shouldTrigger = // was 'n' (inner var)
          (
            options.checkTrigger !== null && options.checkTrigger !== undefined
              ? options.checkTrigger
              : (evt, keyEvt) => {
                  // was (t,e) => ...
                  const isTriggerKey = keyEvt.key === options.trigger
                  if (isTriggerKey && keyEvt.key !== ' ') {
                    keyEvt.preventDefault()
                    keyEvt.stopPropagation()
                  }
                  return isTriggerKey
                }
          )(view, event)

        if (shouldTrigger) {
          if (event.key === options.accept && hasSuggestion) {
            event.preventDefault()
            event.stopPropagation()
            acceptSuggestion(editor.chain(), suggestionDecoration)
            abortPreviousRequest()
            return true
          }
          if (debounceTimeoutId) clearTimeout(debounceTimeoutId)
          debounceTimeoutId = setTimeout(() => {
            handleKeyDownForAutocompletion(view)
          }, options.debounce)
          return false
        }

        switch (event.key) {
          case 'Escape':
            if (hasSuggestion) {
              abortPreviousRequest()
              clearDecorations()
            }
            break
          case options.accept: // Accept key (e.g. Tab)
            if (hasSuggestion) {
              event.preventDefault()
              event.stopPropagation()
              acceptSuggestion(editor.chain(), suggestionDecoration)
              abortPreviousRequest()
              return true
            }
            break
          default:
            abortPreviousRequest()
            clearDecorations()
            if (debounceTimeoutId) clearTimeout(debounceTimeoutId)
            break
        }
        return false
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

// Tries to restore selection to encompass the newly inserted/replaced content
const restoreSelectionAfterReplace = ({dispatch, tr, oldSelection}) => {
  if (dispatch) {
    const findLastReplaceStepResolvedPos = ((transaction, minStepIndex, bias) => {
      // was 'r'
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
        // was (t,e,n,o)
        if (resolvedPos === 0) resolvedPos = newEnd
      })
      return prosemirrorState.Selection.near(transaction.doc.resolve(resolvedPos), bias)
    })(tr, tr.steps.length - 1, -1)

    if (findLastReplaceStepResolvedPos !== -1) {
      const newSelection = ((transaction, newResolvedSelection, previousSelection) => {
        // was 'i'
        const {doc} = transaction
        const docStart = prosemirrorState.TextSelection.atStart(doc).from
        const docEnd = prosemirrorState.TextSelection.atEnd(doc).to
        const from = tiptapCore.minMax(previousSelection.from, docStart, docEnd)
        const to = tiptapCore.minMax(newResolvedSelection.to, docStart, docEnd)
        return prosemirrorState.TextSelection.create(doc, from, to)
      })(tr, findLastReplaceStepResolvedPos, oldSelection)

      tr.setSelection(newSelection)
      dispatch(tr)
      return true
    }
  }
  return false
}

const resolveAiCompletionRequest = async ({action, text, textOptions, extensionOptions}) => {
  var _a, _b
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
    if (
      (responseData === null || responseData === void 0 ? void 0 : responseData.error) instanceof
      Object
    ) {
      throw new Error(
        `${(_a = responseData === null || responseData === void 0 ? void 0 : responseData.error) === null || _a === void 0 ? void 0 : _a.status} ${(_b = responseData === null || responseData === void 0 ? void 0 : responseData.error) === null || _b === void 0 ? void 0 : _b.message}`,
      )
    }
    throw new Error(
      `${responseData === null || responseData === void 0 ? void 0 : responseData.error} ${responseData === null || responseData === void 0 ? void 0 : responseData.message}`,
    )
  }
  return responseData === null || responseData === void 0 ? void 0 : responseData.response
}

const aiCompletionCommand =
  ({props, action, textOptions, extensionOptions, fetchDataFn}) =>
  async () => {
    var _a
    const {editor} = props
    const {
      state,
      state: {selection},
    } = editor // `selection` was 'd'
    const aiStorage = editor.storage.ai || editor.storage.aiAdvanced // `aiStorage` was 'p'

    const resolvedTextOptions = {
      // `resolvedTextOptions` was 'u'
      collapseToEnd: true,
      format: 'plain-text',
      ...textOptions,
    }

    const {
      from,
      to,
    } = // `from` was 'm', `to` was 'g'
      typeof resolvedTextOptions.insertAt === 'number'
        ? {from: resolvedTextOptions.insertAt, to: resolvedTextOptions.insertAt}
        : resolvedTextOptions.insertAt || selection

    const textToProcess = // `textToProcess` was 'h'
      (textOptions === null || textOptions === void 0 ? void 0 : textOptions.text) ||
      (resolvedTextOptions.plainText && resolvedTextOptions.format !== 'plain-text'
        ? state.doc.textBetween(from, to, ' ')
        : getHtmlContentBetween(editor, from, to))

    const shouldInsert =
      (textOptions === null || textOptions === void 0 ? void 0 : textOptions.insert) !== false // `shouldInsert` was 'v'
    const shouldAppend = resolvedTextOptions.append && resolvedTextOptions.insertAt === undefined // `shouldAppend` was 'f'

    if (!textToProcess) {
      return false
    }
    if (textOptions.startsInline === undefined) {
      textOptions.startsInline = isSelectionSpanningMultipleBlocks(selection)
    }

    Object.assign(aiStorage, {
      state: 'loading',
      response: '',
      error: undefined,
      generatedWith: {options: textOptions, action: action, range: undefined},
    })
    editor.chain().setMeta('aiResponse', aiStorage).run()
    ;(_a = extensionOptions.onLoading) === null ||
      _a === void 0 ||
      _a.call(extensionOptions, {editor, action, isStreaming: false})

    let insertPosition = from // `insertPosition` was 'x'
    if (resolvedTextOptions.append) {
      insertPosition = to
    }

    return editor.commands.streamContent(
      // Using streamContent for unified update logic, though it's not a "stream" here
      shouldAppend ? to : {from, to},
      async ({write}) => {
        var _b, _c
        try {
          const responseText = await fetchDataFn({
            // `WorkspaceDataFn` was 'i'
            editor,
            action,
            text: textToProcess,
            textOptions,
            extensionOptions,
            defaultResolver: resolveAiCompletionRequest, // was `w`
          })

          if (!responseText) return false

          Object.assign(aiStorage, {
            state: 'idle',
            message: responseText, // Note: API might return 'message' or 'response'
            error: undefined,
            generatedWith: {
              options: textOptions,
              action,
              range: shouldInsert ? {from, to} : undefined,
            },
          })
          aiStorage.pastResponses.push(responseText)

          if (shouldInsert) {
            const writeResult = write({
              // `writeResult` was 'e'
              partial: responseText,
              appendToChain: chain =>
                chain
                  .setMeta('aiResponse', aiStorage)
                  .command(({dispatch, tr}) =>
                    restoreSelectionAfterReplace({dispatch, tr, oldSelection: {from, to}}),
                  ),
            })
            if (aiStorage.generatedWith) {
              aiStorage.generatedWith.range = {from: writeResult.from, to: writeResult.to}
            }
          } else {
            editor.chain().setMeta('aiResponse', aiStorage).run()
          }

          Object.assign(aiStorage, {
            state: 'idle',
            response: responseText,
            error: undefined,
            generatedWith: {
              options: textOptions,
              action,
              range: shouldInsert ? {from: insertPosition, to} : undefined,
            },
          })
          aiStorage.pastResponses.push(responseText)
          ;(_b = extensionOptions.onSuccess) === null ||
            _b === void 0 ||
            _b.call(extensionOptions, {editor, action, isStreaming: false, response: responseText})

          editor.chain().setMeta('aiResponse', aiStorage).run()
          return true
        } catch (error) {
          Object.assign(aiStorage, {
            state: 'error',
            response: undefined,
            error: error,
            generatedWith: {options: textOptions, action, range: undefined},
          })
          editor.chain().setMeta('aiResponse', aiStorage).run()
          ;(_c = extensionOptions.onError) === null ||
            _c === void 0 ||
            _c.call(extensionOptions, error, {editor, action, isStreaming: false})
          return false
        }
      },
    )
    return true
  }

const resolveAiImageRequest = async ({text, imageOptions, extensionOptions}) => {
  var _a, _b
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
    if ((errorData === null || errorData === void 0 ? void 0 : errorData.error) instanceof Object) {
      throw new Error(
        `${(_a = errorData === null || errorData === void 0 ? void 0 : errorData.error) === null || _a === void 0 ? void 0 : _a.status} ${(_b = errorData === null || errorData === void 0 ? void 0 : errorData.error) === null || _b === void 0 ? void 0 : _b.message}`,
      )
    }
    throw new Error(
      `${errorData === null || errorData === void 0 ? void 0 : errorData.error} ${errorData === null || errorData === void 0 ? void 0 : errorData.message}`,
    )
  }
  const responseData = await response.json()
  return responseData === null || responseData === void 0 ? void 0 : responseData.response // Assuming the image URL is in 'response'
}

const aiImageCommand =
  ({props, imageOptions, extensionOptions, fetchDataFn}) =>
  async () => {
    var _a, _b, _c, _d
    const {editor} = props
    const {state} = editor
    const {
      selection: {from, to},
    } = state

    const textForImage =
      (_a = imageOptions === null || imageOptions === void 0 ? void 0 : imageOptions.text) !==
        null && _a !== void 0
        ? _a
        : state.doc.textBetween(from, to, ' ')

    ;(_b = extensionOptions.onLoading) === null ||
      _b === void 0 ||
      _b.call(extensionOptions, {action: 'image', isStreaming: false, editor})

    try {
      const imageUrl = await fetchDataFn({
        editor,
        text: textForImage,
        imageOptions,
        extensionOptions,
      }) // fetchDataFn was 'o'
      editor.chain().focus().setImage({src: imageUrl, alt: textForImage, title: textForImage}).run()
      ;(_c = extensionOptions.onSuccess) === null ||
        _c === void 0 ||
        _c.call(extensionOptions, {action: 'image', isStreaming: false, editor})
      return true
    } catch (error) {
      ;(_d = extensionOptions.onError) === null ||
        _d === void 0 ||
        _d.call(extensionOptions, error, {action: 'image', isStreaming: false, editor})
      return false
    }
  }

const dispatchAiTextAction = (commandProps, action, textActionOptions) => {
  const {editor} = commandProps
  const {stream = false} = textActionOptions
  const aiExtension = editor.extensionManager.extensions.find(
    ext => ext.name === 'ai' || ext.name === 'aiAdvanced',
  )
  const aiStorage = editor.storage.ai || editor.storage.aiAdvanced

  if (!aiExtension || aiStorage.state === 'loading') {
    return false
  }

  const {baseUrl} = aiExtension.options

  // Demo endpoint warning
  if (
    (() => {
      // IIFE for environment check
      if (typeof window === 'undefined') return true // Skip in non-browser env
      const {location} = window
      const {hostname} = location
      return ![
        'localhost',
        'tiptap.dev',
        'embed-pro.tiptap.dev',
        'ai-demo.tiptap.dev',
        'demos.tiptap.dev',
        'demo-pitch.tiptap.dev',
      ].includes(hostname)
    })() &&
    baseUrl === AI_DEMO_BASE_URL
  ) {
    console.warn(
      '[tiptap-ai] You’re using our demo AI endpoint. This is highly discouraged in your own projects and may break things.\n\nPlease register an account at https://tiptap.dev',
    )
  }

  if (stream) {
    aiStreamCommand({
      props: commandProps,
      action,
      textOptions: textActionOptions,
      extensionOptions: aiExtension.options,
      fetchDataFn: resolveAiStreamRequest, // Was `c`
      // defaultResolver: resolveAiStreamRequest, // This was part of fetchDataFn's signature, now directly passed
    })()
    return true
  } else {
    aiCompletionCommand({
      props: commandProps,
      action,
      textOptions: textActionOptions,
      extensionOptions: aiExtension.options,
      fetchDataFn: resolveAiCompletionRequest, // Was `w`
      // defaultResolver: resolveAiCompletionRequest, // As above
    })()
    return true
  }
}

// Calculates the "effective" depth of a fragment for insertion purposes.
// If preferFirstChild is true, it traverses down .firstChild.content, otherwise .lastChild.content.
function getFragmentContentDepth(fragment, preferFirstChild) {
  var _a, _b
  if (!fragment) return -1
  return (
    1 +
    getFragmentContentDepth(
      preferFirstChild
        ? (_a = fragment.firstChild) === null || _a === void 0
          ? void 0
          : _a.content
        : (_b = fragment.lastChild) === null || _b === void 0
          ? void 0
          : _b.content,
      preferFirstChild,
    )
  )
}

const StreamContentPluginKey = new prosemirrorState.PluginKey('streamContent')
let streamTransactionListeners = [] // Was `C`

const StreamContentExtension = tiptapCore.Extension.create({
  name: 'streamContent',
  onTransaction({transaction}) {
    streamTransactionListeners.forEach(listener => listener(transaction))
  },
  addCommands() {
    return {
      streamContent:
        (rangeOrPosition, streamHandlerFn, options) =>
        ({editor}) => {
          // rangeOrPosition was 'e', streamHandlerFn was 'n', options was 'r'
          const respondInline =
            (options === null || options === void 0 ? void 0 : options.respondInline) === undefined
              ? true
              : options.respondInline // was 'l'
          const streamStartTime = Date.now() // was 'c'
          let from = -1,
            to = -1 // `from` was 'd', `to` was 'p'

          if (typeof rangeOrPosition === 'number') {
            from = rangeOrPosition
            to = rangeOrPosition
          } else if ('from' in rangeOrPosition && 'to' in rangeOrPosition) {
            from = rangeOrPosition.from
            to = rangeOrPosition.to
          }

          const isCollapsedSelection = from === to // was 'u'
          if (from === -1 || to === -1) return false

          let currentFragmentSize = 0 // was 'm'
          const contentAccumulator = ContentAccumulator.create() // was 'g'
          const mapping = new prosemirrorTransform.Mapping() // was 'h'

          function transactionListener(transaction) {
            // was 'v'
            if (
              !transaction.docChanged ||
              (transaction.getMeta(StreamContentPluginKey) !== undefined &&
                transaction.getMeta(StreamContentPluginKey).startTime === streamStartTime)
            ) {
              // Do not apply mapping if the change is from this stream or no doc change
            } else {
              mapping.appendMapping(transaction.mapping)
            }
          }
          streamTransactionListeners.push(transactionListener)

          const defaultTransformFragment = (
            transformInput, // was 'f'
          ) =>
            prosemirrorModel.Fragment.from(
              tiptapCore.createNodeFromContent(
                transformInput.buffer,
                transformInput.editor.state.schema,
                {
                  parseOptions: (options === null || options === void 0
                    ? void 0
                    : options.parseOptions) || {preserveWhitespace: false},
                },
              ),
            )

          ;(async () => {
            const streamControls = {
              // was 'e'
              cleanup() {
                const initialLength = streamTransactionListeners.length
                streamTransactionListeners = streamTransactionListeners.filter(
                  listener => listener !== transactionListener,
                )
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
                partial: partialContent, // was 'e' (inner)
                transform: transformFn = defaultTransformFragment, // was 'n' (inner)
                appendToChain: chainAppender = chain => chain, // was 'i' (inner)
              }) {
                var _a
                let chain = editor.chain()
                if (contentAccumulator.content === '' && !isCollapsedSelection) {
                  chain = chain.deleteRange({from, to})
                }
                contentAccumulator.append(partialContent)

                chain = chain
                  .setMeta(StreamContentPluginKey, {
                    startTime: streamStartTime,
                    partial: contentAccumulator.lastPartial,
                    buffer: contentAccumulator.content,
                    done: true, // Should be true only on final write?
                  })
                  .setMeta('preventClearDocument', true) // Prevent accidental clearing

                const fragmentToInsert = prosemirrorModel.Fragment.from(
                  // was 'v' (inner var)
                  transformFn({
                    partial: contentAccumulator.lastPartial,
                    buffer: contentAccumulator.content,
                    editor,
                    defaultTransform: (
                      customBuffer, // was 't' (inner param)
                    ) =>
                      defaultTransformFragment({
                        buffer: customBuffer || contentAccumulator.content,
                        partial: partialContent,
                        editor,
                      }),
                  }),
                )

                let isFragmentInvalid = false // was 'x'
                try {
                  fragmentToInsert.forEach(node => {
                    node.check()
                  })
                } catch (err) {
                  isFragmentInvalid = true
                }

                if (
                  (frag => {
                    // was 'e' (inner func)
                    let isEmpty = true
                    frag.forEach(node => {
                      if (isEmpty) {
                        isEmpty = tiptapCore.isNodeEmpty(node, {
                          checkChildren: true,
                          ignoreWhitespace: true,
                        })
                      }
                    })
                    return isEmpty
                  })(fragmentToInsert) ||
                  isFragmentInvalid
                ) {
                  chain.run()
                  return {
                    buffer: contentAccumulator.content,
                    from: mapping.map(from),
                    to: mapping.map(from) + currentFragmentSize,
                  }
                }

                const isFirstChildText =
                  ((_a = fragmentToInsert.firstChild) === null || _a === void 0
                    ? void 0
                    : _a.isText) || false // was 'y'
                const maxDocSize = editor.state.doc.nodeSize - 2 // was 'w'

                let mappedFrom = tiptapCore.minMax(
                  mapping.map(from, 1),
                  isFirstChildText ? 1 : 0,
                  maxDocSize,
                ) // was 'O'
                const mappedTo = tiptapCore.minMax(mappedFrom + currentFragmentSize, 0, maxDocSize) // was 'S'

                if (mappedFrom === 1 && !isFirstChildText) {
                  // Ensure block nodes can be inserted at doc start
                  mappedFrom = 0
                }

                let newRange = {from: mappedFrom, to: mappedTo} // was 'b'

                chain = chain.command(({tr}) => {
                  tr.replaceRange(
                    mappedFrom,
                    mappedTo,
                    new prosemirrorModel.Slice(
                      fragmentToInsert,
                      respondInline
                        ? Math.min(
                            tr.doc.resolve(mappedFrom).depth,
                            getFragmentContentDepth(fragmentToInsert, true),
                          )
                        : 0,
                      0,
                    ),
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
                  // For direct pipeTo scenarios
                  const textDecoder = new TextDecoder('utf-8')
                  return new WritableStream({
                    write: (
                      chunkValue, // was 'n' (param)
                    ) =>
                      new Promise(resolve => {
                        const decodedChunk = textDecoder.decode(chunkValue, {stream: true}) // was 'i'
                        streamControls.write({partial: decodedChunk})
                        resolve()
                      }),
                    close() {
                      streamControls.cleanup()
                    },
                  })
                },
              })
            } finally {
              streamControls.cleanup()
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
    state: 'idle', // 'loading', 'error', 'idle'
    response: undefined,
    error: undefined,
    generatedWith: undefined, // { options, action, range }
  }),

  addOptions: () => ({
    appId: 'YOUR_APP_ID',
    token: 'YOUR_TOKEN_HERE',
    baseUrl: AI_DEFAULT_BASE_URL,
    autocompletion: false,
    autocompletionOptions: {
      inputLength: 4000,
      trigger: 'Tab', // Or other key like space, or a specific sequence
      // modelName: undefined, // Optional model override
      // checkTrigger: (view, event) => boolean, // Custom logic to determine if autocompletion should trigger
      // accept: 'Tab', // Key to accept the suggestion
      // debounce: 0, // Debounce time in ms for triggering autocompletion
    },
    append: false, // Default behavior for AI commands (e.g. complete)
    collapseToEnd: true, // Default behavior after insertion
    aiStreamResolver: resolveAiStreamRequest,
    aiCompletionResolver: resolveAiCompletionRequest,
    aiImageResolver: resolveAiImageRequest,
    onLoading: () => null,
    onSuccess: () => null,
    onError: () => null,
    // showDecorations: true, // For aiMark during streaming
  }),

  addExtensions: () => [AiMark.configure(), StreamContentExtension.configure()],

  addProseMirrorPlugins() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k // For nullish coalescing on autocompletionOptions
    const plugins = [] // was 'p'

    if (this.editor.options.injectCSS) {
      tiptapCore.createStyleTag(
        `
                .tiptap-ai-suggestion {
                  cursor: pointer;
                  pointer-events: none; /* So text below can be selected */
                }

                .tiptap-ai-suggestion::after {
                  color: #6B7280; /* gray-500 */
                  content: attr(data-suggestion);
                  pointer-events: none;
                }

                /* Fix for extra line breaks in suggestions */
                .tiptap-ai-suggestion br:first-child,
                .tiptap-ai-suggestion br:last-child {
                  content: ' ';
                  display: inline;
                }
                `,
        this.editor.options.injectNonce,
        'ai',
      )
    }

    if (this.options.autocompletion) {
      const autocompletionOptions = this.options.autocompletionOptions // was 'e'
      plugins.push(
        AiAutocompletionPlugin({
          editor: this.editor,
          options: {
            appId: this.options.appId,
            token: this.options.token,
            baseUrl: this.options.baseUrl || AI_DEFAULT_BASE_URL,
            inputLength:
              ((_a = autocompletionOptions) === null || _a === void 0 ? void 0 : _a.inputLength) ||
              4000, // was 'e' -> autocompletionOptions
            modelName:
              (_b = autocompletionOptions) === null || _b === void 0 ? void 0 : _b.modelName, // was 'n'
            trigger:
              ((_c = autocompletionOptions) === null || _c === void 0 ? void 0 : _c.trigger) ||
              'Tab', // was 'o'
            checkTrigger:
              (_d = autocompletionOptions) === null || _d === void 0 ? void 0 : _d.checkTrigger, // was 'i'
            accept:
              (_h =
                (_g =
                  (_f = autocompletionOptions) === null || _f === void 0 ? void 0 : _f.accept) !==
                  null && _g !== void 0
                  ? _g
                  : (_e = autocompletionOptions) === null || _e === void 0
                    ? void 0
                    : _e.trigger) !== null && _h !== void 0
                ? _h
                : 'Tab', // was 'l', 'r', 'a', 's'
            debounce:
              (_k =
                (_j = autocompletionOptions) === null || _j === void 0 ? void 0 : _j.debounce) !==
                null && _k !== void 0
                ? _k
                : 0, // was 'd', 'c'
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
        // cmdProps was 'e', imagePromptOptions was 't'
        const {editor, state: editorState} = cmdProps // editor was 'o', editorState was 'i'
        const aiExtensionInstance = editor.extensionManager.extensions.find(
          // was 'a'
          ext => ext.name === 'ai' || ext.name === 'aiAdvanced',
        )
        const {
          selection: {from, to},
        } = editorState // 'r', 's'
        const textForImage =
          (imagePromptOptions === null || imagePromptOptions === void 0
            ? void 0
            : imagePromptOptions.text) !== null && imagePromptOptions.text !== undefined // 'n'
            ? imagePromptOptions.text
            : editorState.doc.textBetween(from, to, ' ') // 'l'

        const imageExtension = editor.extensionManager.extensions.find(ext => ext.name === 'image') // 'c'

        if (!textForImage || !aiExtensionInstance) return false
        if (!imageExtension) {
          throw new Error('[tiptap-ai] Image extension is not loaded.')
        }

        aiImageCommand({
          props: cmdProps,
          // text: textForImage, // text is part of imageOptions now
          imageOptions: imagePromptOptions,
          extensionOptions: aiExtensionInstance.options,
          fetchDataFn: aiExtensionInstance.options.aiImageResolver,
        })()
        return true
      },

    aiAccept:
      ({insertAt, append} = {}) =>
      ({dispatch, editor, chain}) => {
        var _a, _b, _c
        const aiStorage = editor.storage.ai || editor.storage.aiAdvanced
        const {from, to} =
          typeof insertAt === 'number'
            ? {from: insertAt, to: insertAt}
            : insertAt || editor.state.selection

        const effectiveAppend = // 'p'
          append !== null && append !== undefined
            ? append
            : typeof insertAt === 'number' ||
              ((_b =
                (_a =
                  aiStorage === null || aiStorage === void 0 ? void 0 : aiStorage.generatedWith) ===
                  null || _a === void 0
                  ? void 0
                  : _a.options) === null || _b === void 0
                ? void 0
                : _b.append)

        if (
          aiStorage.state === 'loading' ||
          aiStorage.state === 'error' ||
          aiStorage.response === undefined ||
          ((_c = aiStorage === null || aiStorage === void 0 ? void 0 : aiStorage.generatedWith) ===
            null || _c === void 0
            ? void 0
            : _c.range) // Already inserted
        ) {
          return false
        }

        if (dispatch) {
          const {response: responseText} = aiStorage
          Object.assign(aiStorage, {
            state: 'idle',
            response: undefined,
            error: undefined,
            generatedWith: undefined,
          })
          aiStorage.pastResponses = [] // Clear history on accept

          chain()
            .setMeta('aiResponse', aiStorage)
            .focus()
            .insertContentAt(effectiveAppend ? to : {from, to}, responseText, {
              parseOptions: {preserveWhitespace: false},
              errorOnInvalidContent: false,
            })
            .run()
        }
        return true
      },

    aiReject:
      ({type = 'reset'} = {}) =>
      ({dispatch, editor, chain}) => {
        var _a
        const aiStorage = editor.storage.ai || editor.storage.aiAdvanced
        if (
          aiStorage.state === 'error' ||
          aiStorage.response === undefined ||
          ((_a = aiStorage === null || aiStorage === void 0 ? void 0 : aiStorage.generatedWith) ===
            null || _a === void 0
            ? void 0
            : _a.range) // Already inserted
        ) {
          return false
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
            Object.assign(aiStorage, {state: 'idle'}) // Keeps response for potential future accept
          }
          chain().setMeta('aiResponse', aiStorage).run()
        }
        return true
      },

    aiRegenerate:
      ({insert, insertAt} = {}) =>
      props => {
        const {dispatch, editor} = props
        const aiStorage = editor.storage.ai || editor.storage.aiAdvanced

        if (aiStorage.pastResponses.length === 0 || !aiStorage.generatedWith) {
          return false
        }
        // If insert is true, but we don't have a range or a specific insertAt point, it's problematic.
        if (insert && !aiStorage.generatedWith.range && insertAt === undefined) {
          return false
        }

        if (dispatch) {
          let optionsForRegeneration = aiStorage.generatedWith.options
          if (insert || (insert === undefined && aiStorage.generatedWith.range)) {
            optionsForRegeneration = {
              ...optionsForRegeneration,
              insert: true,
              insertAt:
                insertAt !== null && insertAt !== undefined
                  ? insertAt
                  : aiStorage.generatedWith.range,
            }
          }
          return dispatchAiTextAction(props, aiStorage.generatedWith.action, optionsForRegeneration)
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
  // editorContext was 'n'
  try {
    let node = tiptapCore.createNodeFromContent(content, editorContext.schema, {
      parseOptions: {preserveWhitespace: false},
    })
    // If createNodeFromContent returns a Doc node, get its content
    if ('nodeSize' in node && node.type.name === 'doc') {
      // Check if it's a full document node
      node = node.content
    }
    return tiptapCore.getHTMLFromFragment(node, editorContext.schema)
  } catch (error) {
    return null
  }
}
