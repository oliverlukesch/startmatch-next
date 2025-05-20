import {useCallback, useState} from 'react'

import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {Textarea} from '@/components/ui/textarea'

import {cn} from '@/lib/utils'

interface CommentCardProps {
  name: string
  content: string | null
  createdAt: string
  deleted?: boolean
  onEdit?: (content: string) => void
  onDelete?: () => void
  showActions?: boolean
}

export const CommentCard = ({
  name,
  content,
  createdAt,
  deleted = false,
  onEdit,
  onDelete,
  showActions = false,
}: CommentCardProps) => {
  const [isComposing, setIsComposing] = useState(false)
  const [composeValue, setComposeValue] = useState(content || '')

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()

      if (onEdit) {
        setIsComposing(false)
        onEdit(composeValue)
      }
    },
    [composeValue, onEdit],
  )

  return (
    <Card className={cn('flex flex-col gap-0.5', deleted && 'opacity-50')}>
      <div className="flex flex-row flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <span className="font-bold text-foreground">{name}</span>
        <span>·</span>
        <span>{new Date(createdAt).toLocaleTimeString()}</span>
      </div>

      {deleted && (
        <div className="text-sm">
          <p>Comment was deleted</p>
        </div>
      )}

      {!isComposing && !deleted ? (
        <div className="flex flex-col gap-2.5">
          <p className="text-sm">{content}</p>
          {showActions ? (
            <div className="flex gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsComposing(true)
                }}>
                Edit
              </Button>
              {onDelete ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={e => {
                    e.preventDefault()
                    e.stopPropagation()
                    onDelete()
                  }}>
                  Delete
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {isComposing && !deleted ? (
        <div>
          <form onSubmit={handleSubmit}>
            <Textarea
              value={composeValue}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setComposeValue(e.currentTarget.value)
              }
              className="min-h-[4.5rem] resize-none"
            />
            <div className="mt-1.5 flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsComposing(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!composeValue.length || composeValue === content}>
                Accept
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </Card>
  )
}
