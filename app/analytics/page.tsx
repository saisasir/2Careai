'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { AppSidebar } from '@/components/app-sidebar'
import { AppHeader } from '@/components/app-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { Activity, Clock, CheckCircle, Target, AlertTriangle } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface LatencyStats {
  avgTotal: number
  avgSTT: number
  avgAgent: number
  avgTTS: number
  p50: number
  p95: number
  p99: number
  targetMetRate: number
  totalRequests: number
}

interface LatencyBreakdown {
  stage: string
  avgMs: number
  targetMs: number
}

interface LatencyMetric {
  sessionId: string
  timestamp: string
  stages: {
    sttLatency?: number
    languageDetection?: number
    agentLatency?: number
    toolExecution?: number
    ttsLatency?: number
  }
  totalLatency: number
  targetMet: boolean
}

const TARGET_LATENCY = 450 // ms

const callVolumeData = [
  { day: 'Mon', calls: 145, successful: 138 },
  { day: 'Tue', calls: 168, successful: 159 },
  { day: 'Wed', calls: 189, successful: 180 },
  { day: 'Thu', calls: 156, successful: 148 },
  { day: 'Fri', calls: 178, successful: 170 },
  { day: 'Sat', calls: 98, successful: 92 },
  { day: 'Sun', calls: 67, successful: 63 }
]

const languageDistribution = [
  { name: 'English', value: 52, color: 'oklch(0.72 0.19 160)' },
  { name: 'Hindi', value: 31, color: 'oklch(0.65 0.18 250)' },
  { name: 'Tamil', value: 17, color: 'oklch(0.75 0.15 80)' }
]

const appointmentsBySpecialization = [
  { name: 'General', count: 45 },
  { name: 'Cardiology', count: 28 },
  { name: 'Dermatology', count: 22 },
  { name: 'Orthopedic', count: 18 },
  { name: 'Pediatrics', count: 15 }
]

const intentBreakdown = [
  { intent: 'Book Appointment', count: 456, percentage: 42 },
  { intent: 'Check Availability', count: 278, percentage: 26 },
  { intent: 'Reschedule', count: 189, percentage: 17 },
  { intent: 'Cancel', count: 98, percentage: 9 },
  { intent: 'General Inquiry', count: 65, percentage: 6 }
]

export default function AnalyticsPage() {
  const { data: latencyData } = useSWR<{ stats: LatencyStats, breakdown: LatencyBreakdown[], recent: LatencyMetric[] }>(
    '/api/latency?type=all',
    fetcher,
    { refreshInterval: 5000 }
  )

  const [latencyHistory, setLatencyHistory] = useState<Array<{ time: string, latency: number, target: number }>>([])

  useEffect(() => {
    if (latencyData?.recent) {
      const history = latencyData.recent.slice(-20).map((m, i) => ({
        time: new Date(m.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        latency: m.totalLatency,
        target: TARGET_LATENCY
      }))
      setLatencyHistory(history)
    }
  }, [latencyData])

  const stats = latencyData?.stats || {
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

  const breakdown = latencyData?.breakdown || []

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="pl-64">
        <AppHeader title="Analytics" subtitle="Performance metrics and latency monitoring" />
        <div className="p-6 space-y-6">
          {/* Filters */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Select defaultValue="7d">
                <SelectTrigger className="w-40 bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline" 
                className={stats.avgTotal < TARGET_LATENCY ? 'border-primary text-primary' : 'border-destructive text-destructive'}
              >
                <Activity className="h-3 w-3 mr-1" />
                {stats.avgTotal < TARGET_LATENCY ? 'Target Met' : 'Above Target'}
              </Badge>
              <Badge variant="outline" className="border-border">
                Auto-refresh: 5s
              </Badge>
            </div>
          </div>

          {/* Latency Metrics */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Avg Response Time</p>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className={`text-3xl font-bold ${stats.avgTotal < TARGET_LATENCY ? 'text-primary' : 'text-destructive'}`}>
                    {stats.avgTotal}
                  </span>
                  <span className="text-sm text-muted-foreground">ms</span>
                </div>
                <p className={`text-xs mt-1 ${stats.avgTotal < TARGET_LATENCY ? 'text-primary' : 'text-destructive'}`}>
                  {stats.avgTotal < TARGET_LATENCY 
                    ? `${TARGET_LATENCY - stats.avgTotal}ms under target` 
                    : `${stats.avgTotal - TARGET_LATENCY}ms over target`}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Target Met Rate</p>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className={`text-3xl font-bold ${stats.targetMetRate >= 90 ? 'text-primary' : 'text-chart-3'}`}>
                    {stats.targetMetRate}
                  </span>
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {'<'} 450ms target
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">P50 Latency</p>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold text-foreground">{stats.p50}</span>
                  <span className="text-sm text-muted-foreground">ms</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Median response</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">P95 Latency</p>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className={`text-3xl font-bold ${stats.p95 < TARGET_LATENCY ? 'text-foreground' : 'text-chart-3'}`}>
                    {stats.p95}
                  </span>
                  <span className="text-sm text-muted-foreground">ms</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">95th percentile</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Total Requests</p>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold text-foreground">{stats.totalRequests}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Measured calls</p>
              </CardContent>
            </Card>
          </div>

          {/* Latency Breakdown */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Latency Breakdown by Stage
                <Badge variant="outline" className="ml-2 text-xs">Target: {TARGET_LATENCY}ms total</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {breakdown.map((stage) => (
                  <div key={stage.stage} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{stage.stage}</span>
                      <div className="flex items-center gap-4">
                        <span className={`font-mono ${stage.avgMs <= stage.targetMs ? 'text-primary' : 'text-destructive'}`}>
                          {stage.avgMs}ms
                        </span>
                        <span className="text-muted-foreground text-xs">
                          target: {stage.targetMs}ms
                        </span>
                      </div>
                    </div>
                    <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${stage.avgMs <= stage.targetMs ? 'bg-primary' : 'bg-destructive'}`}
                        style={{ width: `${Math.min((stage.avgMs / stage.targetMs) * 100, 100)}%` }}
                      />
                      <div 
                        className="absolute top-0 h-full w-0.5 bg-muted-foreground/50"
                        style={{ left: '100%' }}
                      />
                    </div>
                  </div>
                ))}
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-foreground">Total Pipeline</span>
                    <div className="flex items-center gap-4">
                      <span className={`font-mono font-bold ${stats.avgTotal <= TARGET_LATENCY ? 'text-primary' : 'text-destructive'}`}>
                        {stats.avgTotal}ms
                      </span>
                      <span className="text-muted-foreground text-xs">
                        target: {TARGET_LATENCY}ms
                      </span>
                    </div>
                  </div>
                  <Progress 
                    value={Math.min((stats.avgTotal / TARGET_LATENCY) * 100, 100)} 
                    className="mt-2 h-3"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Charts Row 1 */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Call Volume */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Call Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={callVolumeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.005 270)" />
                      <XAxis 
                        dataKey="day" 
                        tick={{ fill: 'oklch(0.65 0 0)', fontSize: 11 }}
                        axisLine={{ stroke: 'oklch(0.28 0.005 270)' }}
                      />
                      <YAxis 
                        tick={{ fill: 'oklch(0.65 0 0)', fontSize: 11 }}
                        axisLine={{ stroke: 'oklch(0.28 0.005 270)' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'oklch(0.17 0.005 270)',
                          border: '1px solid oklch(0.28 0.005 270)',
                          borderRadius: '8px',
                          color: 'oklch(0.98 0 0)'
                        }}
                      />
                      <Bar dataKey="calls" fill="oklch(0.65 0.18 250)" radius={[4, 4, 0, 0]} name="Total Calls" />
                      <Bar dataKey="successful" fill="oklch(0.72 0.19 160)" radius={[4, 4, 0, 0]} name="Successful" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Response Latency Trend */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Response Latency Trend (Real-time)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={latencyHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.005 270)" />
                      <XAxis 
                        dataKey="time" 
                        tick={{ fill: 'oklch(0.65 0 0)', fontSize: 11 }}
                        axisLine={{ stroke: 'oklch(0.28 0.005 270)' }}
                      />
                      <YAxis 
                        tick={{ fill: 'oklch(0.65 0 0)', fontSize: 11 }}
                        axisLine={{ stroke: 'oklch(0.28 0.005 270)' }}
                        domain={[200, 600]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'oklch(0.17 0.005 270)',
                          border: '1px solid oklch(0.28 0.005 270)',
                          borderRadius: '8px',
                          color: 'oklch(0.98 0 0)'
                        }}
                        formatter={(value: number, name: string) => [
                          `${value}ms`,
                          name === 'latency' ? 'Response Time' : 'Target'
                        ]}
                      />
                      <ReferenceLine 
                        y={TARGET_LATENCY} 
                        stroke="oklch(0.55 0.2 25)" 
                        strokeDasharray="5 5"
                        label={{ value: 'Target', fill: 'oklch(0.55 0.2 25)', fontSize: 10 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="latency" 
                        stroke="oklch(0.72 0.19 160)" 
                        strokeWidth={2}
                        dot={{ fill: 'oklch(0.72 0.19 160)', strokeWidth: 0, r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Language Distribution */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Language Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={languageDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {languageDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'oklch(0.17 0.005 270)',
                          border: '1px solid oklch(0.28 0.005 270)',
                          borderRadius: '8px',
                          color: 'oklch(0.98 0 0)'
                        }}
                        formatter={(value: number) => [`${value}%`, 'Usage']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 mt-2">
                  {languageDistribution.map((lang) => (
                    <div key={lang.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: lang.color }} />
                      <span className="text-xs text-muted-foreground">{lang.name} ({lang.value}%)</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Appointments by Specialization */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Appointments by Specialization</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={appointmentsBySpecialization} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.005 270)" horizontal={false} />
                      <XAxis 
                        type="number"
                        tick={{ fill: 'oklch(0.65 0 0)', fontSize: 11 }}
                        axisLine={{ stroke: 'oklch(0.28 0.005 270)' }}
                      />
                      <YAxis 
                        type="category"
                        dataKey="name"
                        tick={{ fill: 'oklch(0.65 0 0)', fontSize: 11 }}
                        axisLine={{ stroke: 'oklch(0.28 0.005 270)' }}
                        width={80}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'oklch(0.17 0.005 270)',
                          border: '1px solid oklch(0.28 0.005 270)',
                          borderRadius: '8px',
                          color: 'oklch(0.98 0 0)'
                        }}
                      />
                      <Bar dataKey="count" fill="oklch(0.72 0.19 160)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Intent Breakdown */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Intent Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {intentBreakdown.map((item) => (
                    <div key={item.intent} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{item.intent}</span>
                        <span className="text-muted-foreground">{item.count} ({item.percentage}%)</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
