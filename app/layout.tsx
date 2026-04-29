import type { Metadata, Viewport } from 'next'
import './globals.css'

const SITE_URL = 'https://cuemath-sage.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Cuemath AI Tutor Screener',
    template: '%s | Cuemath',
  },
  description:
    'Voice-based AI screening for Cuemath tutor candidates. Speak your answers to 5 structured questions and get scored across 5 dimensions — no scheduling, no inconsistency.',
  keywords: [
    'Cuemath', 'tutor screening', 'AI interview', 'voice interview',
    'automated screening', 'hiring tool', 'EdTech',
  ],
  authors: [{ name: 'Cuemath' }],
  creator: 'Cuemath',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'Cuemath AI Tutor Screener',
    title: 'Cuemath AI Tutor Screener',
    description:
      'Voice-based AI screening for Cuemath tutor candidates. 5 questions · structured rubric · instant results.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Cuemath AI Tutor Screener — voice-based hiring tool',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cuemath AI Tutor Screener',
    description:
      'Voice-based AI screening for Cuemath tutor candidates. 5 questions · structured rubric · instant results.',
    images: ['/opengraph-image'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32', type: 'image/x-icon' },
      { url: '/icon', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon', sizes: '180x180', type: 'image/png' }],
    shortcut: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  themeColor: '#f97316',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
