import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function synthesizeSpeech(text: string): Promise<ArrayBuffer | null> {
  if (!process.env.OPENAI_API_KEY) return null
  try {
    const response = await client.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: text,
    })
    return response.arrayBuffer()
  } catch (e) {
    console.error('OpenAI TTS error:', e)
    return null
  }
}
