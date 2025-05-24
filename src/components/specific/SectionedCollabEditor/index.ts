'use client'

import dynamic from 'next/dynamic'

export const SectionedCollabEditor = dynamic(() => import('./SectionedCollabEditor'), {ssr: false})
