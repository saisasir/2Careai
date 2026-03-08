'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Clock, User, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { Appointment } from '@/lib/types'
import { cn } from '@/lib/utils'

interface RecentAppointmentsProps {
  appointments: Appointment[]
}

const statusStyles = {
  scheduled: 'bg-chart-2/20 text-chart-2 border-chart-2/30',
  completed: 'bg-primary/20 text-primary border-primary/30',
  cancelled: 'bg-destructive/20 text-destructive border-destructive/30',
  'no-show': 'bg-warning/20 text-warning border-warning/30'
}

export function RecentAppointments({ appointments }: RecentAppointmentsProps) {
  const sortedAppointments = [...appointments]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Recent Appointments</CardTitle>
          <Button variant="ghost" size="sm" asChild className="text-xs text-muted-foreground hover:text-foreground">
            <Link href="/appointments">
              View all <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedAppointments.map((appointment) => (
          <div
            key={appointment.id}
            className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{appointment.patientName}</p>
                <p className="text-xs text-muted-foreground">{appointment.doctorName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(appointment.date)}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{appointment.time}</span>
                </div>
              </div>
              <Badge variant="outline" className={cn('text-xs capitalize', statusStyles[appointment.status])}>
                {appointment.status}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
