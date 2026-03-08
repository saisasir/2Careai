'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, Clock, Phone, Calendar, TrendingUp, Users } from 'lucide-react'
import type { SystemMetrics } from '@/lib/types'

interface MetricsCardsProps {
  metrics: SystemMetrics
}

export function MetricsCards({ metrics }: MetricsCardsProps) {
  const cards = [
    {
      title: 'Avg Latency',
      value: `${metrics.avgLatencyMs}ms`,
      subtitle: 'Speech to response',
      icon: Clock,
      trend: '-12ms',
      trendUp: true
    },
    {
      title: 'Total Calls',
      value: metrics.totalCalls.toLocaleString(),
      subtitle: 'Last 24 hours',
      icon: Phone,
      trend: '+8.2%',
      trendUp: true
    },
    {
      title: 'Success Rate',
      value: `${metrics.successRate}%`,
      subtitle: 'Completed conversations',
      icon: TrendingUp,
      trend: '+2.1%',
      trendUp: true
    },
    {
      title: 'Active Sessions',
      value: metrics.activeConversations.toString(),
      subtitle: 'Live conversations',
      icon: Activity,
      trend: 'Live',
      trendUp: true
    },
    {
      title: 'Today\'s Appointments',
      value: metrics.appointmentsToday.toString(),
      subtitle: 'Scheduled for today',
      icon: Calendar,
      trend: '+4',
      trendUp: true
    },
    {
      title: 'Weekly Appointments',
      value: metrics.appointmentsThisWeek.toString(),
      subtitle: 'This week total',
      icon: Users,
      trend: '+12%',
      trendUp: true
    }
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => (
        <Card key={card.title} className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{card.value}</div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground">{card.subtitle}</p>
              <span className={`text-xs font-medium ${card.trendUp ? 'text-primary' : 'text-destructive'}`}>
                {card.trend}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
