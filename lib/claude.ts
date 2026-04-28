import OpenAI from 'openai'
import type { TranscriptEntry, RubricResult } from '@/types'
import { INTERVIEWER_SYSTEM, EVALUATOR_SYSTEM } from './prompts'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const INTERVIEWER_MODEL = 'gpt-4o-mini'
const EVALUATOR_MODEL = 'gpt-4o-mini'

export interface InterviewerResponse {
  utterance: string
  currentQuestionIndex: number
  utteranceType: string
  isComplete: boolean
}

const SPEAK_TOOL: OpenAI.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'speak',
    description: 'Speak the next thing to the candidate, with state metadata about where we are in the interview.',
    parameters: {
      type: 'object',
      required: ['utterance', 'current_question_index', 'utterance_type', 'is_complete'],
      properties: {
        utterance: {
          type: 'string',
          description: 'The text to speak to the candidate. 1-3 sentences max. No markdown, no stage directions.',
        },
        current_question_index: {
          type: 'integer',
          minimum: 1,
          maximum: 5,
          description: 'Which of the 5 questions the candidate is currently working on. Does not change for follow-ups, clarification requests, or redirects on the same question.',
        },
        utterance_type: {
          type: 'string',
          enum: ['asking_question', 'follow_up', 'redirect', 'clarification_request', 'transition', 'closing'],
        },
        is_complete: {
          type: 'boolean',
          description: 'True only in the closing utterance after the candidate has answered question 5.',
        },
      },
    },
  },
}

export async function getInterviewerResponse(
  transcript: TranscriptEntry[]
): Promise<InterviewerResponse> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
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
    messages: [{ role: 'system', content: INTERVIEWER_SYSTEM }, ...messages],
    tools: [SPEAK_TOOL],
    tool_choice: 'required',
  })

  const choice = response.choices?.[0]
  const toolCall = choice?.message?.tool_calls?.[0]
  if (!toolCall) throw new Error('No tool call from interviewer')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fn = (toolCall as any).function as { arguments: string } | undefined
  if (!fn?.arguments) throw new Error('Interviewer tool call missing function arguments')

  let args: Record<string, unknown>
  try {
    args = JSON.parse(fn.arguments)
  } catch {
    throw new Error('Interviewer tool call had invalid JSON')
  }
  if (!args.utterance) throw new Error('Interviewer response missing utterance')
  return {
    utterance: args.utterance as string,
    currentQuestionIndex: (args.current_question_index as number) ?? 1,
    utteranceType: (args.utterance_type as string) ?? 'asking_question',
    isComplete: Boolean(args.is_complete),
  }
}

const EVALUATE_TOOL: OpenAI.Chat.ChatCompletionTool = {
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
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'user', content: userMessage },
    ]
    if (retryNote) {
      messages.push({
        role: 'user',
        content: `${retryNote} Please re-run the evaluation. Every evidence_quote must be a verbatim substring of what the candidate actually said.`,
      })
    }

    const response = await client.chat.completions.create({
      model: EVALUATOR_MODEL,
      max_tokens: 2000,
      messages: [{ role: 'system', content: EVALUATOR_SYSTEM }, ...messages],
      tools: [EVALUATE_TOOL],
      tool_choice: 'required',
    })

    const toolCall = response.choices?.[0]?.message?.tool_calls?.[0]
    if (!toolCall) throw new Error('No tool call from evaluator')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fnArgs = ((toolCall as any).function as { arguments: string } | undefined)?.arguments
    if (!fnArgs) throw new Error('Evaluator tool call missing function arguments')

    return JSON.parse(fnArgs) as RubricResult
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
