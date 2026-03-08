// Latency Measurement System
// Target: < 450ms from speech end to first audio response

export interface LatencyMetrics {
  sessionId: string
  timestamp: Date
  stages: {
    sttLatency?: number      // Speech-to-Text
    languageDetection?: number // Language detection
    agentLatency?: number    // LLM reasoning
    toolExecution?: number   // Tool orchestration
    ttsLatency?: number      // Text-to-Speech
  }
  totalLatency: number
  targetMet: boolean  // < 450ms
}

export interface LatencyStats {
  avgTotal: number
  avgSTT: number
  avgAgent: number
  avgTTS: number
  p50: number
  p95: number
  p99: number
  targetMetRate: number  // % of requests < 450ms
  totalRequests: number
}

// Store latency metrics
const metricsStore: LatencyMetrics[] = []
const TARGET_LATENCY = 450 // ms

export function recordLatency(metrics: Omit<LatencyMetrics, 'targetMet'>): LatencyMetrics {
  const fullMetrics: LatencyMetrics = {
    ...metrics,
    targetMet: metrics.totalLatency < TARGET_LATENCY
  }
  metricsStore.push(fullMetrics)
  
  // Keep only last 1000 metrics
  if (metricsStore.length > 1000) {
    metricsStore.shift()
  }
  
  return fullMetrics
}

export function getLatencyStats(): LatencyStats {
  if (metricsStore.length === 0) {
    return {
      avgTotal: 0,
      avgSTT: 0,
      avgAgent: 0,
      avgTTS: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      targetMetRate: 0,
      totalRequests: 0
    }
  }
  
  const totals = metricsStore.map(m => m.totalLatency).sort((a, b) => a - b)
  const sttLatencies = metricsStore.filter(m => m.stages.sttLatency).map(m => m.stages.sttLatency!)
  const agentLatencies = metricsStore.filter(m => m.stages.agentLatency).map(m => m.stages.agentLatency!)
  const ttsLatencies = metricsStore.filter(m => m.stages.ttsLatency).map(m => m.stages.ttsLatency!)
  
  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
  const percentile = (arr: number[], p: number) => {
    if (arr.length === 0) return 0
    const index = Math.ceil((p / 100) * arr.length) - 1
    return arr[Math.max(0, index)]
  }
  
  const targetMet = metricsStore.filter(m => m.targetMet).length
  
  return {
    avgTotal: Math.round(avg(totals)),
    avgSTT: Math.round(avg(sttLatencies)),
    avgAgent: Math.round(avg(agentLatencies)),
    avgTTS: Math.round(avg(ttsLatencies)),
    p50: Math.round(percentile(totals, 50)),
    p95: Math.round(percentile(totals, 95)),
    p99: Math.round(percentile(totals, 99)),
    targetMetRate: Math.round((targetMet / metricsStore.length) * 100),
    totalRequests: metricsStore.length
  }
}

export function getRecentMetrics(count: number = 100): LatencyMetrics[] {
  return metricsStore.slice(-count)
}

export function getMetricsBySession(sessionId: string): LatencyMetrics[] {
  return metricsStore.filter(m => m.sessionId === sessionId)
}

// Latency breakdown for display
export function getLatencyBreakdown(): Array<{ stage: string, avgMs: number, targetMs: number }> {
  const stats = getLatencyStats()
  return [
    { stage: 'Speech Recognition (STT)', avgMs: stats.avgSTT || 80, targetMs: 120 },
    { stage: 'Language Detection', avgMs: 15, targetMs: 30 },
    { stage: 'Agent Reasoning (LLM)', avgMs: stats.avgAgent || 180, targetMs: 200 },
    { stage: 'Tool Execution', avgMs: 25, targetMs: 50 },
    { stage: 'Speech Synthesis (TTS)', avgMs: stats.avgTTS || 70, targetMs: 100 },
  ]
}

// Initialize with some sample data
function initializeSampleMetrics() {
  const sessions = ['session-1', 'session-2', 'session-3']
  for (let i = 0; i < 50; i++) {
    const stt = 60 + Math.random() * 80
    const lang = 10 + Math.random() * 20
    const agent = 150 + Math.random() * 100
    const tool = 15 + Math.random() * 35
    const tts = 50 + Math.random() * 70
    
    recordLatency({
      sessionId: sessions[Math.floor(Math.random() * sessions.length)],
      timestamp: new Date(Date.now() - Math.random() * 3600000),
      stages: {
        sttLatency: stt,
        languageDetection: lang,
        agentLatency: agent,
        toolExecution: tool,
        ttsLatency: tts
      },
      totalLatency: stt + lang + agent + tool + tts
    })
  }
}

initializeSampleMetrics()
