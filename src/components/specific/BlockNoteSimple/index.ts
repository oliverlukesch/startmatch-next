'use client'

import dynamic from 'next/dynamic'

// context: https://www.blocknotejs.org/docs/advanced/nextjs
export const BlockNoteSimple = dynamic(() => import('./BlockNoteSimple'), {ssr: false})
