'use client'

import {TCollabThread, TiptapCollabProvider} from '@hocuspocus/provider'

import {useThreadsState} from '../context'
import {ThreadsListItem} from './ThreadsListItem'

interface ThreadsListProps {
  provider: TiptapCollabProvider
  threads: TCollabThread[]
}

export const ThreadsList = ({provider, threads}: ThreadsListProps) => {
  const {selectedThreads, selectedThread} = useThreadsState()

  if (threads.length === 0) {
    return <label className="label">No threads.</label>
  }

  return (
    <div className="threads-group">
      {threads.map(t => (
        <ThreadsListItem
          key={t.id}
          thread={t}
          active={selectedThreads.includes(t.id) || selectedThread === t.id}
          open={selectedThread === t.id}
          provider={provider}
        />
      ))}
    </div>
  )
}
