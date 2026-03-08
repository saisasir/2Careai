import { NextRequest, NextResponse } from 'next/server'
import { backendAuthGet } from '@/lib/backend-client'
import { getLatencyStats, getRecentMetrics, getLatencyBreakdown, recordLatency } from '@/lib/latency-tracker'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'stats'
  const count = parseInt(searchParams.get('count') || '100')

  // For 'stats' and 'breakdown', attempt to pull from real backend metrics
  if (type === 'stats' || type === 'all') {
    try {
      const backendMetrics = await backendAuthGet('/metrics')
      // Transform backend metric format to frontend expected format
      const stats = {
        avgTotal: backendMetrics.avg_latency_ms ?? 0,
        avgStt: backendMetrics.pipeline_stages?.stt_avg_ms ?? 0,
        avgLlm: backendMetrics.pipeline_stages?.llm_avg_ms ?? 0,
        avgTts: backendMetrics.pipeline_stages?.tts_avg_ms ?? 0,
        totalRequests: backendMetrics.total_requests ?? 0,
        activeSessions: backendMetrics.active_sessions ?? 0,
        meetingTarget: (backendMetrics.avg_latency_ms ?? 0) < 450,
        source: 'backend',
      }

      if (type === 'all') {
        return NextResponse.json({
          stats,
          breakdown: getLatencyBreakdown(),
          recent: getRecentMetrics(20),
          raw: backendMetrics,
        })
      }
      return NextResponse.json(stats)
    } catch {
      // Backend unreachable — fall back to local in-memory tracker
    }
  }

  switch (type) {
    case 'stats':
      return NextResponse.json(getLatencyStats())
    case 'recent':
      return NextResponse.json(getRecentMetrics(count))
    case 'breakdown':
      return NextResponse.json(getLatencyBreakdown())
    case 'all':
      return NextResponse.json({
        stats: getLatencyStats(),
        breakdown: getLatencyBreakdown(),
        recent: getRecentMetrics(20),
      })
    default:
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }
}

// Record new latency metrics (stored locally in Next.js process memory)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionId, stages, totalLatency } = body

    if (!sessionId || !totalLatency) {
      return NextResponse.json({ error: 'sessionId and totalLatency required' }, { status: 400 })
    }

    const metrics = recordLatency({
      sessionId,
      timestamp: new Date(),
      stages: stages || {},
      totalLatency,
    })

    return NextResponse.json(metrics, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
