import {TiptapCollabProvider} from '@hocuspocus/provider'
import {TCollabThread} from '@hocuspocus/provider'

import {ThreadsListItem} from './ThreadsListItem'

interface ThreadsListProps {
  threads: TCollabThread[]
  provider: TiptapCollabProvider
}

export const ThreadsList = ({threads, provider}: ThreadsListProps) => {
  return (
    <div className="flex flex-col gap-2">
      {threads.map(t => (
        <ThreadsListItem key={t.id} thread={t} provider={provider} />
      ))}
    </div>
  )
}
