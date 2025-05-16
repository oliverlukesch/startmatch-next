'use client'

import dynamic from 'next/dynamic'

// context: https://www.blocknotejs.org/docs/advanced/nextjs
export const CollabEditor = dynamic(() => import('./MFCollabEditor'), {ssr: false})
