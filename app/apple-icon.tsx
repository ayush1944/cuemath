import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 36,
          background: 'linear-gradient(135deg, #f97316, #ef4444)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 800,
          fontSize: 110,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        C
      </div>
    ),
    { ...size }
  )
}
