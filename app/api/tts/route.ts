import { NextResponse } from 'next/server'
import { synthesizeSpeech } from '@/lib/elevenlabs'

export async function POST(request: Request) {
  let text = ''
  try {
    const body = await request.json()
    text = body.text ?? ''
    if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 })

    const audio = await synthesizeSpeech(text)

    if (!audio) {
      return NextResponse.json({ use_browser: true, text })
    }

    return new Response(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('POST /api/tts', e)
    return NextResponse.json({ use_browser: true, text })
  }
}
