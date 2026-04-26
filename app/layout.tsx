import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cuemath Tutor Screening',
  description: 'AI-powered first-round screening for Cuemath tutor candidates',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
