import {useCallback, useEffect, useRef} from 'react'

import {Card} from '@/components/ui/card'

import {cn} from '@/lib/utils'

interface ThreadCardProps {
  id: string
  active?: boolean
  open?: boolean
  children: React.ReactNode
  onClick?: (id: string) => void
  onClickOutside?: () => void
}

export const ThreadCard = ({
  id,
  active = false,
  open = false,
  children,
  onClick,
  onClickOutside,
}: ThreadCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null)

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick(id)
    }
  }, [id, onClick])

  useEffect(() => {
    if (!active) {
      return
    }

    const clickHandler = onClickOutside
      ? (event: MouseEvent) => {
          if (!cardRef.current) {
            return
          }

          if (!cardRef.current.contains(event.target as Node)) {
            onClickOutside()
          }
        }
      : null

    if (clickHandler) {
      document.addEventListener('click', clickHandler)
    }

    return () => {
      if (clickHandler) {
        document.removeEventListener('click', clickHandler)
      }
    }
  }, [active, onClickOutside])

  return (
    <Card
      ref={cardRef}
      className={cn(
        'flex flex-col transition-all duration-200 ease-out',
        active && 'ring-1 ring-muted-foreground/20',
        open && 'ring-1 ring-primary',
      )}
      onClick={handleClick}>
      {children}
    </Card>
  )
}
