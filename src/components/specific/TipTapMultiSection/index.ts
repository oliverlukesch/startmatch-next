'use client'

import dynamic from 'next/dynamic'

export const CollabEditor = dynamic(() => import('./TipTapMultiSection'), {ssr: false})
export {HistorySidebar} from './HistorySidebar'
