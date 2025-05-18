'use client'

import dynamic from 'next/dynamic'

export const BlockNoteSimple = dynamic(() => import('./BlockNoteSimple'), {ssr: false})
