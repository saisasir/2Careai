'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Phone, Clock, Globe } from 'lucide-react'
import type { VoiceSession } from '@/lib/types'
import { languageLabels } from '@/lib/mock-data'

interface ActiveSessionsProps {
  sessions: VoiceSession[]
}

function formatDuration(startTime: Date) {
  const now = new Date()
  const diffMs = now.getTime() - startTime.getTime()
  const minutes = Math.floor(diffMs / 60000)
  const seconds = Math.floor((diffMs % 60000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function SessionDuration({ startTime }: { startTime: Date }) {
  const [duration, setDuration] = useState('--:--')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setDuration(formatDuration(startTime))
    
    const interval = setInterval(() => {
      setDuration(formatDuration(startTime))
    }, 1000)
    
    return () => clearInterval(interval)
  }, [startTime])

  if (!mounted) return <span>--:--</span>
  return <span>{duration}</span>
}

export function ActiveSessions({ sessions }: ActiveSessionsProps) {
  const activeSessions = sessions.filter(s => s.status === 'active')

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Active Sessions</CardTitle>
          <Badge variant="outline" className="border-primary text-primary">
            {activeSessions.length} Live
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeSessions.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No active sessions</p>
          </div>
        ) : (
          activeSessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full border-2 border-card animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {session.patientName || 'Unknown Caller'}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <SessionDuration startTime={session.startTime} />
                    <Globe className="h-3 w-3 ml-1" />
                    <span>{languageLabels[session.language]}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-mono border-border">
                  {session.latencyMs || '--'}ms
                </Badge>
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  View
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
