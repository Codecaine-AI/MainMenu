import type { Metadata } from 'next'
import { DesktopBridgeProbe } from './_components/DesktopBridgeProbe'
import './globals.css'

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
      <body className="bg-black text-gray-300 antialiased" style={{ colorScheme: 'dark' }}>
        <DesktopBridgeProbe />
        {children}
      </body>
    </html>
  )
}
