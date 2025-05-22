import {Button} from '@/components/ui/button'

import {cn} from '@/lib/utils'

import {renderDate} from './utils'

interface VersionItemProps {
  title?: string
  date: string | number | Date
  isActive: boolean
  onClick: () => void
}

export const VersionItem = ({title, date, isActive, onClick}: VersionItemProps) => {
  return (
    <Button
      variant="ghost"
      className={cn(
        'w-full justify-start font-normal',
        isActive && 'bg-accent text-accent-foreground',
      )}
      onClick={onClick}>
      <div className="flex flex-col items-start gap-1">
        <span>{title || renderDate(date)}</span>
        {title && <span className="text-xs text-muted-foreground">{renderDate(date)}</span>}
      </div>
    </Button>
  )
}
