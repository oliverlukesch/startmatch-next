import {useCallback, useMemo} from 'react'

import {TiptapCollabProvider} from '@hocuspocus/provider'
import {TCollabThread} from '@hocuspocus/provider'

import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'

import {cn} from '@/lib/utils'

import {useThreadsState} from '../context'
import {CommentCard} from './CommentCard'
import {ThreadComposer} from './ThreadComposer'

interface ThreadsListItemProps {
  thread: TCollabThread
  provider: TiptapCollabProvider
}

export const ThreadsListItem = ({thread, provider}: ThreadsListItemProps) => {
  const {
    selectedThread,
    onClickThread,
    deleteThread,
    resolveThread,
    unresolveThread,
    onHoverThread,
    onLeaveThread,
  } = useThreadsState()

  const isSelected = selectedThread === thread.id

  const firstComment = useMemo(() => {
    return thread.comments[0] || null
  }, [thread.comments])

  const handleClick = useCallback(() => {
    onClickThread(thread.id)
  }, [onClickThread, thread.id])

  const handleDelete = useCallback(() => {
    deleteThread(thread.id)
  }, [deleteThread, thread.id])

  const handleResolve = useCallback(() => {
    resolveThread(thread.id)
  }, [resolveThread, thread.id])

  const handleUnresolve = useCallback(() => {
    unresolveThread(thread.id)
  }, [unresolveThread, thread.id])

  const handleMouseEnter = useCallback(() => {
    onHoverThread(thread.id as unknown as number)
  }, [onHoverThread, thread.id])

  const handleMouseLeave = useCallback(() => {
    onLeaveThread()
  }, [onLeaveThread])

  if (!firstComment) {
    return null
  }

  return (
    <Card
      className={cn(
        'flex flex-col gap-2 p-2',
        isSelected && 'border-primary',
        thread.resolvedAt && 'opacity-50',
      )}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {thread.resolvedAt ? (
            <Button variant="ghost" size="sm" onClick={handleUnresolve}>
              Unresolve
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={handleResolve}>
              Resolve
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <CommentCard
          name={firstComment.data.userName}
          content={firstComment.content}
          createdAt={firstComment.createdAt}
          deleted={!!firstComment.deletedAt}
        />

        {isSelected && !thread.resolvedAt && (
          <ThreadComposer threadId={thread.id} provider={provider} />
        )}
      </div>
    </Card>
  )
}
