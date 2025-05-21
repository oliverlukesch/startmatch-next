'use client'

import dynamic from 'next/dynamic'

export const CollabEditor = dynamic(() => import('./TipTapMultiField'), {ssr: false})
