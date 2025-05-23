import type {Metadata} from 'next'

import {AppSidebar} from '@/components/global/AppSidebar'
import {SidebarInset, SidebarProvider} from '@/components/ui/sidebar'

import './globals.css'

export const metadata: Metadata = {
  title: 'StartMatch Next',
  description: 'Grants, automated',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>{children}</SidebarInset>
        </SidebarProvider>
      </body>
    </html>
  )
}
