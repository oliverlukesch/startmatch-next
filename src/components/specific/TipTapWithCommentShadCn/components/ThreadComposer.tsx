import {useCallback, useState} from 'react'

import {TiptapCollabProvider} from '@hocuspocus/provider'

import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {Textarea} from '@/components/ui/textarea'

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

      if (!comment) {
        return
      }

      if (provider) {
        provider.addComment(threadId, {
          content: comment,
          data: {userName: user?.name},
        })

        setComment('')
      }
    },
    [comment, provider, threadId, user?.name],
  )

  return (
    <Card className="p-2">
      <form onSubmit={handleSubmit}>
        <Textarea
          placeholder="Reply to thread …"
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            setComment(e.currentTarget.value)
          }
          value={comment}
          className="min-h-[4.5rem] resize-none"
        />
        <div className="mt-1.5 flex gap-2">
          <Button type="submit" size="sm" disabled={!comment.length}>
            Send
          </Button>
        </div>
      </form>
    </Card>
  )
}
