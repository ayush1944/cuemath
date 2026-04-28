import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function transcribeAudio(file: File): Promise<string> {
  const transcription = await client.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    response_format: 'text',
  })
  return (transcription as unknown as string).trim()
}
