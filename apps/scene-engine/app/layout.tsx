import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CODECAINE — Scene Engine',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-gray-300 antialiased" style={{ colorScheme: 'dark' }}>
        {children}
      </body>
    </html>
  )
}
