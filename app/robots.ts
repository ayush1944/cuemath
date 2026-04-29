import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/interview'],
        disallow: ['/admin', '/api/'],
      },
    ],
    sitemap: 'https://cuemath-sage.vercel.app/sitemap.xml',
  }
}
