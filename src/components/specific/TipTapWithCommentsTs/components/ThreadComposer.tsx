'use client'

import {useCallback, useState} from 'react'

import {TiptapCollabProvider} from '@hocuspocus/provider'

import {useThreadsState} from '../context'

interface ThreadComposerProps {
  threadId: string
  provider: TiptapCollabProvider
}

export const ThreadComposer = ({threadId, provider}: ThreadComposerProps) => {
  const {user} = useThreadsState()
  const [comment, setComment] = useState('')

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()

      if (!comment || !user) {
        return
      }

      if (provider) {
        provider.addComment(threadId, {
          content: comment,
          data: {userName: user.name},
        })

        setComment('')
      }
    },
    [comment, provider, threadId, user],
  )

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        placeholder="Reply to thread …"
        onChange={e => setComment(e.currentTarget.value)}
        value={comment}
      />
      <div className="flex-row">
        <div className="button-group">
          <button type="submit" className="primary" disabled={!comment.length}>
            Send
          </button>
        </div>
      </div>
    </form>
  )
}
