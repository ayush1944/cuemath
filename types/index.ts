export interface TranscriptEntry {
  role: 'ai' | 'candidate'
  content: string
  timestamp: string
  questionNumber?: number
}

export interface DimensionScore {
  score: number
  justification: string
  evidence_quote: string
}

export interface RubricResult {
  overall_recommendation: 'advance' | 'maybe' | 'do_not_advance'
  overall_summary: string
  dimensions: {
    communication_clarity: DimensionScore
    warmth: DimensionScore
    ability_to_simplify: DimensionScore
    patience: DimensionScore
    english_fluency: DimensionScore
  }
  strengths: string[]
  concerns: string[]
  validated: boolean
}

export interface FocusEvent {
  event: 'tab_hidden' | 'tab_visible'
  timestamp: number
  hidden_duration_ms?: number
}

export interface Session {
  id: string
  candidateName: string
  candidateEmail: string
  candidateRole: string
  startedAt: string
  completedAt?: string
  status: 'in_progress' | 'completed' | 'abandoned'
  transcript: TranscriptEntry[]
  rubric?: RubricResult
  currentQuestionIndex?: number
  lastUtteranceType?: string
  focus_events?: FocusEvent[]
}
