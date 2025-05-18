'use client'

import dynamic from 'next/dynamic'

export const TipTapMultiField = dynamic(() => import('./TipTapMultiField'), {ssr: false})
