import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: '#FAFAF8',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        {/* Background gradient blobs */}
        <div
          style={{
            position: 'absolute',
            top: -80,
            right: -80,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -60,
            left: -60,
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 70%)',
          }}
        />

        {/* Logo mark */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 20,
            background: 'linear-gradient(135deg, #f97316, #ef4444)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: 48,
            marginBottom: 28,
            boxShadow: '0 8px 32px rgba(249,115,22,0.35)',
          }}
        >
          C
        </div>

        {/* Brand name */}
        <div
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: '#888',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 20,
          }}
        >
          Cuemath
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: '#111',
            textAlign: 'center',
            lineHeight: 1.15,
            maxWidth: 760,
            marginBottom: 20,
          }}
        >
          AI Tutor Screening
        </div>

        {/* Subline */}
        <div
          style={{
            fontSize: 24,
            color: '#666',
            textAlign: 'center',
            maxWidth: 620,
            lineHeight: 1.5,
            marginBottom: 48,
          }}
        >
          Voice-based first-round interviews · 5 questions · structured rubric output
        </div>

        {/* Pill tags */}
        <div style={{ display: 'flex', gap: 12 }}>
          {['GPT-4o-mini', 'OpenAI Whisper', 'TTS', 'Redis'].map((tag) => (
            <div
              key={tag}
              style={{
                padding: '8px 18px',
                borderRadius: 99,
                background: '#fff',
                border: '1px solid #e5e5e0',
                fontSize: 16,
                color: '#555',
                fontWeight: 500,
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
