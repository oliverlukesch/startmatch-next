'use client'

import {Button} from '@/components/ui/button'
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip'

interface ToolbarButtonProps {
  label: string
  icon: React.ElementType
  onClick: () => void
  isDisabled?: boolean
  isActive?: boolean
}

export default function ToolbarButton({
  label,
  icon: Icon,
  onClick,
  isDisabled = false,
  isActive = false,
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={isActive ? 'secondary' : 'ghost'}
          size="icon"
          disabled={isDisabled}
          onClick={onClick}
          className="h-8 w-8">
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
