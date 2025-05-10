'use client'

import {Button} from '@/components/ui/button'

export default function Home() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center">
      <Button variant="outline" onClick={() => console.log('Button clicked!')}>
        Button
      </Button>
    </main>
  )
}
