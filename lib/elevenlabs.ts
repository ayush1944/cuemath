const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM' // Rachel

export async function synthesizeSpeech(text: string): Promise<ArrayBuffer | null> {
  if (!ELEVENLABS_API_KEY) return null

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  )

  if (!response.ok) return null
  return response.arrayBuffer()
}
