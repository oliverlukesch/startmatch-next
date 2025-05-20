'use client'

import {useCallback, useState} from 'react'

interface CommentCardProps {
  name: string
  createdAt: number | string
  deleted?: boolean
  content: string | null
  onEdit?: (content: string) => void
  onDelete?: () => void
  showActions?: boolean
}

export const CommentCard = ({
  name,
  createdAt,
  deleted,
  content,
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

  const commentWrapperClass = ['comment']

  if (deleted) {
    commentWrapperClass.push('deleted')
  }

  return (
    <div className={commentWrapperClass.join(' ')}>
      <div className="label-group">
        <label>{name}</label>
        <label>{new Date(createdAt).toLocaleTimeString()}</label>
      </div>

      {deleted && (
        <div className="comment-content">
          <p>Comment was deleted</p>
        </div>
      )}

      {!isComposing && !deleted ? (
        <div className="comment-content">
          <p>{content}</p>
          {showActions ? (
            <div className="button-group">
              <button
                onClick={e => {
                  e.preventDefault()
                  e.stopPropagation()

                  setIsComposing(true)
                }}>
                Edit
              </button>
              {onDelete ? (
                <button
                  onClick={e => {
                    e.preventDefault()
                    e.stopPropagation()

                    onDelete()
                  }}>
                  Delete
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {isComposing && !deleted ? (
        <div className="comment-edit">
          <form onSubmit={handleSubmit}>
            <textarea onChange={e => setComposeValue(e.currentTarget.value)} value={composeValue} />
            <div className="flex-row">
              <div className="button-group">
                <button type="reset" onClick={() => setIsComposing(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary"
                  disabled={!composeValue.length || composeValue === content}>
                  Accept
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}
