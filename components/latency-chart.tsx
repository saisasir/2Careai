'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { latencyData } from '@/lib/mock-data'

export function LatencyChart() {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Response Latency</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Speech-to-response time (ms)</p>
          </div>
          <Badge variant="outline" className="border-primary text-primary">
            Target: {'<'}450ms
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={latencyData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.72 0.19 160)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.72 0.19 160)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.005 270)" />
              <XAxis
                dataKey="time"
                tick={{ fill: 'oklch(0.65 0 0)', fontSize: 11 }}
                tickLine={{ stroke: 'oklch(0.28 0.005 270)' }}
                axisLine={{ stroke: 'oklch(0.28 0.005 270)' }}
              />
              <YAxis
                tick={{ fill: 'oklch(0.65 0 0)', fontSize: 11 }}
                tickLine={{ stroke: 'oklch(0.28 0.005 270)' }}
                axisLine={{ stroke: 'oklch(0.28 0.005 270)' }}
                domain={[200, 400]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'oklch(0.17 0.005 270)',
                  border: '1px solid oklch(0.28 0.005 270)',
                  borderRadius: '8px',
                  color: 'oklch(0.98 0 0)'
                }}
                labelStyle={{ color: 'oklch(0.65 0 0)' }}
                formatter={(value: number) => [`${value}ms`, 'Latency']}
              />
              <Area
                type="monotone"
                dataKey="latency"
                stroke="oklch(0.72 0.19 160)"
                strokeWidth={2}
                fill="url(#latencyGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
