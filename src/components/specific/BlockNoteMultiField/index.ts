'use client'

import dynamic from 'next/dynamic'

export const CollabEditor = dynamic(() => import('./BlockNoteMultiField'), {ssr: false})
