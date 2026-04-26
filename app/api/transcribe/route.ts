import { NextResponse } from 'next/server'
import { transcribeAudio } from '@/lib/groq'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const text = await transcribeAudio(file)
    return NextResponse.json({ text })
  } catch (e) {
    console.error('POST /api/transcribe', e)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}
