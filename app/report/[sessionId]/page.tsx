import { notFound } from 'next/navigation'
import { getSession } from '@/lib/redis'
import type { DimensionScore } from '@/types'

const DIMENSION_LABELS: Record<string, string> = {
  communication_clarity: 'Communication Clarity',
  warmth: 'Warmth',
  ability_to_simplify: 'Ability to Simplify',
  patience: 'Patience',
  english_fluency: 'English Fluency',
}

const RECOMMENDATION_CONFIG = {
  advance: {
    label: "We'd love to move you forward!",
    bg: '#f0fdf4',
    color: '#15803d',
    border: '#bbf7d0',
  },
  maybe: {
    label: "We're reviewing your responses.",
    bg: '#fffbeb',
    color: '#92400e',
    border: '#fde68a',
  },
  do_not_advance: {
    label: "Thank you for your time.",
    bg: '#f9fafb',
    color: '#374151',
    border: '#e5e7eb',
  },
}

function ScoreBar({ score }: { score: number }) {
  // Orange intensity: 1=lightest, 5=most saturated — warm palette, never red/green
  const fill = score >= 5 ? '#ea580c' : score === 4 ? '#f97316' : score === 3 ? '#fb923c' : score === 2 ? '#fdba74' : '#fed7aa'
  return (
    <div style={{ height: 7, background: '#ffedd5', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ height: '100%', borderRadius: 99, background: fill, width: `${(score / 5) * 100}%` }} />
    </div>
  )
}

function DimensionCard({ name, dim }: { name: string; dim: DimensionScore }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-800 text-sm">{DIMENSION_LABELS[name]}</h3>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#f97316' }}>{dim.score} / 5</span>
      </div>
      <ScoreBar score={dim.score} />
      <p className="text-gray-600 text-sm leading-relaxed mb-2 mt-3">{dim.justification}</p>
      {dim.evidence_quote !== 'insufficient_evidence_to_assess' && (
        <blockquote className="border-l-2 border-orange-200 pl-3 text-xs text-gray-400 italic">
          &ldquo;{dim.evidence_quote}&rdquo;
        </blockquote>
      )}
    </div>
  )
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  const session = await getSession(sessionId)
  if (!session || !session.rubric) notFound()

  const { rubric } = session
  const rec = RECOMMENDATION_CONFIG[rubric.overall_recommendation]

  return (
    <main className="min-h-screen px-4 py-10" style={{ background: '#FAFAF8' }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ background: 'linear-gradient(135deg, #F97316, #ef4444)' }}>C</div>
          <span className="font-semibold text-gray-700">Cuemath</span>
        </div>

        <h1 className="text-2xl font-semibold text-gray-900 mb-1">
          Your interview results
        </h1>
        <p className="text-gray-500 text-sm mb-8">Hi {session.candidateName} — here&apos;s how your interview went.</p>

        {/* Recommendation banner */}
        <div className="rounded-2xl border p-6 mb-8"
          style={{ background: rec.bg, borderColor: rec.border }}>
          <p className="font-semibold text-lg" style={{ color: rec.color }}>
            {rec.label}
          </p>
          <p className="text-sm mt-1" style={{ color: rec.color, opacity: 0.8 }}>
            {rubric.overall_summary}
          </p>
        </div>

        {/* Dimension scores */}
        <h2 className="text-base font-semibold text-gray-800 mb-4">How you did</h2>
        <div className="space-y-3 mb-8">
          {Object.entries(rubric.dimensions).map(([key, dim]) => (
            <DimensionCard key={key} name={key} dim={dim} />
          ))}
        </div>

        {/* Strengths + Growth areas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 text-sm mb-3">Strengths</h3>
            <ul className="space-y-1.5">
              {rubric.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-orange-400 mt-0.5">✓</span> {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 text-sm mb-3">Areas to grow</h3>
            <ul className="space-y-1.5">
              {rubric.concerns.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-amber-400 mt-0.5">→</span> {c}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400">
          The Cuemath team will follow up via email at {session.candidateEmail}.
        </p>
      </div>
    </main>
  )
}
