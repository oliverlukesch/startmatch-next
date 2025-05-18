'use client'

import dynamic from 'next/dynamic'

export const BlockNoteMultiField = dynamic(() => import('./BlockNoteMultiField'), {ssr: false})
