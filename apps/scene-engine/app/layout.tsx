import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AppChrome } from './_components/AppChrome'
import { DesktopBridgeProbe } from './_components/DesktopBridgeProbe'
import './globals.css'
import './extraction-helper.css'

export const metadata: Metadata = {
  title: 'Main Menu',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="unity-body text-gray-300 antialiased" style={{ colorScheme: 'dark' }}>
        <DesktopBridgeProbe />
        <Suspense fallback={children}>
          <AppChrome>{children}</AppChrome>
        </Suspense>
      </body>
    </html>
  )
}
