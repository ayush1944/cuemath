import Groq from 'groq-sdk'

const client = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function transcribeAudio(file: File): Promise<string> {
  const transcription = await client.audio.transcriptions.create({
    file,
    model: 'whisper-large-v3-turbo',
    response_format: 'text',
  })
  return (transcription as unknown as string).trim()
}
