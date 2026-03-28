import type { Metadata } from 'next'
import { Inter, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/layout/Sidebar'
import ServiceWorkerRegistrar from '@/components/layout/ServiceWorkerRegistrar'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'Market Pulse AI',
  description: 'AI-powered stock market intelligence and prediction engine',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${ibmPlexMono.variable} font-sans bg-surface-base`}>
        <ServiceWorkerRegistrar />
        <Sidebar />
        <main className="ml-16 lg:ml-56 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}
