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
    label: "Great news — we'd love to move you forward!",
    sub: 'The team will be in touch shortly with next steps.',
    bg: '#f0fdf4',
    color: '#15803d',
    border: '#bbf7d0',
    badge: 'Advance',
    badgeBg: '#dcfce7',
  },
  maybe: {
    label: "We're reviewing your responses.",
    sub: 'The team will follow up via email soon.',
    bg: '#fffbeb',
    color: '#92400e',
    border: '#fde68a',
    badge: 'Under Review',
    badgeBg: '#fef9c3',
  },
  do_not_advance: {
    label: 'Thank you for your time.',
    sub: 'We appreciate you taking the time to interview with us.',
    bg: '#f9fafb',
    color: '#374151',
    border: '#e5e7eb',
    badge: 'Reviewed',
    badgeBg: '#f3f4f6',
  },
}

function ScoreBar({ score }: { score: number }) {
  const fill =
    score >= 5 ? '#ea580c' :
    score === 4 ? '#f97316' :
    score === 3 ? '#fb923c' :
    score === 2 ? '#fdba74' : '#fed7aa'
  return (
    <div style={{ height: 6, background: '#ffedd5', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ height: '100%', borderRadius: 99, background: fill, width: `${(score / 5) * 100}%`, transition: 'width 0.4s ease' }} />
    </div>
  )
}

function DimensionCard({ name, dim }: { name: string; dim: DimensionScore }) {
  const hasQuote = dim.evidence_quote && dim.evidence_quote !== 'insufficient_evidence_to_assess'
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-800 text-sm">{DIMENSION_LABELS[name]}</h3>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#f97316' }}>{dim.score}<span style={{ fontWeight: 400, color: '#d1d5db' }}>/5</span></span>
      </div>
      <ScoreBar score={dim.score} />
      <p className="text-gray-500 text-sm leading-relaxed mt-3">{dim.justification}</p>
      {hasQuote && (
        <blockquote className="mt-2 border-l-2 border-orange-200 pl-3 text-xs text-gray-400 italic leading-relaxed">
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
  const rec = RECOMMENDATION_CONFIG[rubric.overall_recommendation] ?? RECOMMENDATION_CONFIG.do_not_advance
  const strengths = rubric.strengths ?? []
  const concerns = rubric.concerns ?? []

  const dims = Object.values(rubric.dimensions)
  const avgScore = dims.length ? Math.round((dims.reduce((s, d) => s + d.score, 0) / dims.length) * 10) / 10 : null

  return (
    <main className="min-h-screen px-4 py-10" style={{ background: '#FAFAF8' }}>
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ background: 'linear-gradient(135deg, #F97316, #ef4444)' }}>C</div>
          <span className="font-semibold text-gray-700">Cuemath</span>
        </div>

        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Your interview results</h1>
        <p className="text-gray-400 text-sm mb-8">Hi {session.candidateName} — here&apos;s a summary of your screening interview.</p>

        {/* Recommendation banner */}
        <div className="rounded-2xl border p-6 mb-8 flex items-start gap-4"
          style={{ background: rec.bg, borderColor: rec.border }}>
          <div className="flex-1">
            <p className="font-semibold text-base mb-0.5" style={{ color: rec.color }}>{rec.label}</p>
            <p className="text-sm" style={{ color: rec.color, opacity: 0.75 }}>{rec.sub}</p>
            <p className="text-sm mt-2" style={{ color: rec.color, opacity: 0.6 }}>{rubric.overall_summary}</p>
          </div>
          {avgScore !== null && (
            <div className="text-center flex-shrink-0">
              <div className="text-2xl font-bold" style={{ color: rec.color }}>{avgScore}</div>
              <div className="text-xs" style={{ color: rec.color, opacity: 0.6 }}>avg / 5</div>
            </div>
          )}
        </div>

        {/* Dimension scores */}
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Performance by area</h2>
        <div className="space-y-3 mb-8">
          {Object.entries(rubric.dimensions).map(([key, dim]) => (
            <DimensionCard key={key} name={key} dim={dim} />
          ))}
        </div>

        {/* Strengths + Growth areas */}
        {(strengths.length > 0 || concerns.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {strengths.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-800 text-sm mb-3">Strengths</h3>
                <ul className="space-y-2">
                  {strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-orange-400 mt-0.5 flex-shrink-0">✓</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {concerns.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-800 text-sm mb-3">Areas to grow</h3>
                <ul className="space-y-2">
                  {concerns.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-amber-400 mt-0.5 flex-shrink-0">→</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-400">
          The Cuemath team will follow up via email at{' '}
          <span className="font-medium text-gray-500">{session.candidateEmail}</span>.
        </p>
      </div>
    </main>
  )
}
