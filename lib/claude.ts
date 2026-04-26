import Groq from 'groq-sdk'
import type { TranscriptEntry, RubricResult } from '@/types'
import { INTERVIEWER_SYSTEM, EVALUATOR_SYSTEM } from './prompts'

const client = new Groq({ apiKey: process.env.GROQ_API_KEY })

const INTERVIEWER_MODEL = 'llama-3.3-70b-versatile'
const EVALUATOR_MODEL = 'llama-3.3-70b-versatile'

export async function getInterviewerResponse(
  transcript: TranscriptEntry[],
  currentQuestion: number
): Promise<string> {
  const system =
    INTERVIEWER_SYSTEM +
    `\n\n[Currently on question ${currentQuestion} of 5. Awaiting follow-up decision or next question.]`

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: 'user', content: "Let's begin the interview." },
  ]

  for (const entry of transcript) {
    messages.push({
      role: entry.role === 'ai' ? 'assistant' : 'user',
      content: entry.content,
    })
  }

  const response = await client.chat.completions.create({
    model: INTERVIEWER_MODEL,
    max_tokens: 400,
    messages: [{ role: 'system', content: system }, ...messages],
  })

  return response.choices[0].message.content ?? ''
}

const EVALUATE_TOOL: Groq.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'submit_evaluation',
    description: 'Submit the structured rubric assessment for the candidate',
    parameters: {
      type: 'object',
      properties: {
        overall_recommendation: {
          type: 'string',
          enum: ['advance', 'maybe', 'do_not_advance'],
        },
        overall_summary: { type: 'string' },
        dimensions: {
          type: 'object',
          properties: {
            communication_clarity: dimensionSchema(),
            warmth: dimensionSchema(),
            ability_to_simplify: dimensionSchema(),
            patience: dimensionSchema(),
            english_fluency: dimensionSchema(),
          },
          required: [
            'communication_clarity',
            'warmth',
            'ability_to_simplify',
            'patience',
            'english_fluency',
          ],
        },
        strengths: { type: 'array', items: { type: 'string' }, maxItems: 4 },
        concerns: { type: 'array', items: { type: 'string' }, maxItems: 4 },
      },
      required: [
        'overall_recommendation',
        'overall_summary',
        'dimensions',
        'strengths',
        'concerns',
      ],
    },
  },
}

function dimensionSchema() {
  return {
    type: 'object',
    properties: {
      score: { type: 'number' },
      justification: { type: 'string' },
      evidence_quote: { type: 'string' },
    },
    required: ['score', 'justification', 'evidence_quote'],
  }
}

function buildTranscriptText(transcript: TranscriptEntry[]): string {
  return transcript
    .map((e) => `[${e.role === 'ai' ? 'INTERVIEWER' : 'CANDIDATE'}]: ${e.content}`)
    .join('\n\n')
}

function validateQuotes(rubric: RubricResult, transcript: TranscriptEntry[]): boolean {
  const candidateText = transcript
    .filter((e) => e.role === 'candidate')
    .map((e) => e.content.toLowerCase().replace(/\s+/g, ' ').trim())
    .join(' ')

  for (const dim of Object.values(rubric.dimensions)) {
    const q = dim.evidence_quote
    if (q === 'insufficient_evidence_to_assess') continue
    const normalized = q.toLowerCase().replace(/\s+/g, ' ').trim()
    if (!candidateText.includes(normalized)) return false
  }
  return true
}

// Llama 3 sometimes emits duplicate JSON keys which Groq rejects with 400.
// This extracts the rubric from the raw failed_generation string by removing
// any trailing empty duplicate keys before parsing.
function salvageRubric(failedGen: string): RubricResult | null {
  try {
    // Strip <function=submit_evaluation>...</function> wrapper
    const match = failedGen.match(/<function=\w+>([\s\S]+)<\/function>/)
    const jsonStr = match ? match[1] : failedGen

    // Remove trailing duplicate empty object keys, e.g. `,"dimensions":{}` before final `}`
    const fixed = jsonStr.replace(/,\s*"(\w+)"\s*:\s*\{\s*\}(?=\s*\})/g, '')

    return JSON.parse(fixed) as RubricResult
  } catch {
    return null
  }
}

export async function evaluateInterview(
  transcript: TranscriptEntry[],
  candidateName: string,
  candidateRole: string,
  wordCount: number
): Promise<RubricResult> {
  const transcriptText = buildTranscriptText(transcript)
  const userMessage = `Candidate: ${candidateName} (current role: ${candidateRole})
Word count: ${wordCount}

Full transcript:
${transcriptText}`

  async function runEval(retryNote?: string): Promise<RubricResult> {
    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      { role: 'user', content: userMessage },
    ]
    if (retryNote) {
      messages.push({
        role: 'user',
        content: `${retryNote} Please re-run the evaluation. Every evidence_quote must be a verbatim substring of what the candidate actually said.`,
      })
    }

    let response
    try {
      response = await client.chat.completions.create({
        model: EVALUATOR_MODEL,
        max_tokens: 2000,
        messages: [{ role: 'system', content: EVALUATOR_SYSTEM }, ...messages],
        tools: [EVALUATE_TOOL],
        tool_choice: 'required',
      })
    } catch (err: unknown) {
      // Llama 3 sometimes emits duplicate JSON keys (e.g. "dimensions" twice),
      // causing Groq's schema validator to reject with 400. If the error includes
      // failed_generation we can salvage the rubric from the raw output.
      const failedGen = (err as { error?: { error?: { failed_generation?: string } } })
        ?.error?.error?.failed_generation
      if (failedGen) {
        const salvaged = salvageRubric(failedGen)
        if (salvaged) return salvaged
      }
      throw err
    }

    const toolCall = response.choices[0].message.tool_calls?.[0]
    if (!toolCall) throw new Error('No tool call from evaluator')

    return JSON.parse(toolCall.function.arguments) as RubricResult
  }

  let rubric = await runEval()

  if (!validateQuotes(rubric, transcript)) {
    rubric = await runEval('Some evidence_quotes were not verbatim substrings of the transcript.')
    rubric.validated = validateQuotes(rubric, transcript)
  } else {
    rubric.validated = true
  }

  return rubric
}
