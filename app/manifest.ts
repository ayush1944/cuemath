import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cuemath Tutor Screening',
    short_name: 'Cuemath Screen',
    description: 'AI-powered first-round screening for Cuemath tutor candidates',
    start_url: '/',
    display: 'standalone',
    background_color: '#FAFAF8',
    theme_color: '#f97316',
    icons: [
      {
        src: '/icon',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
