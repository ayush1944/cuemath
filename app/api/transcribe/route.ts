import { NextResponse } from 'next/server'
import { transcribeAudio } from '@/lib/groq'

// Whisper sometimes hallucinates non-Latin text when it hears silence,
// TTS bleed, or background audio. Treat these as no speech detected.
function isGarbage(text: string): boolean {
  const t = text.trim()
  if (!t || t.length < 2) return true
  // More than 30% non-ASCII characters → likely hallucinated foreign text
  const nonAscii = (t.match(/[^\x00-\x7F]/g) ?? []).length
  if (nonAscii / t.length > 0.3) return true
  // Whisper hallucination substrings — specific enough they won't appear in real speech
  // "thank you" is intentionally excluded: candidates say it legitimately
  const lower = t.toLowerCase()
  const hallucinationSubstrings = [
    'thanks for watching', 'please subscribe', 'like and subscribe',
    'ご視聴', '请不吝', 'subtitles by', 'transcribed by',
  ]
  if (hallucinationSubstrings.some(h => lower.includes(h))) return true
  return false
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const text = await transcribeAudio(file)
    if (isGarbage(text)) {
      console.warn('Transcription filtered as garbage:', JSON.stringify(text.slice(0, 80)))
      return NextResponse.json({ text: '' })
    }
    return NextResponse.json({ text })
  } catch (e) {
    console.error('POST /api/transcribe', e)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}
