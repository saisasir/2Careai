'use client'

import { useState } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { AppHeader } from '@/components/app-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, Phone, Clock, Globe, MessageSquare, User, Bot } from 'lucide-react'
import { voiceSessions, languageLabels } from '@/lib/mock-data'
import type { VoiceSession } from '@/lib/types'
import { cn } from '@/lib/utils'

const statusStyles = {
  active: 'bg-primary/20 text-primary border-primary/30',
  completed: 'bg-chart-2/20 text-chart-2 border-chart-2/30',
  failed: 'bg-destructive/20 text-destructive border-destructive/30'
}

export default function ConversationsPage() {
  const [selectedSession, setSelectedSession] = useState<VoiceSession | null>(voiceSessions[0])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filteredSessions = voiceSessions.filter(session => {
    const matchesSearch = session.patientName?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || session.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const formatDuration = (start: Date, end?: Date) => {
    const endTime = end || new Date()
    const diffMs = endTime.getTime() - start.getTime()
    const minutes = Math.floor(diffMs / 60000)
    const seconds = Math.floor((diffMs % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="pl-64">
        <AppHeader title="Conversations" subtitle="View conversation history and transcripts" />
        <div className="p-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Sessions List */}
            <div className="lg:col-span-1 space-y-4">
              <Card className="bg-card border-border">
                <CardContent className="pt-4 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search conversations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 bg-secondary border-border"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {filteredSessions.length} Conversations
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[calc(100vh-320px)]">
                    <div className="space-y-1 p-2">
                      {filteredSessions.map((session) => (
                        <button
                          key={session.id}
                          onClick={() => setSelectedSession(session)}
                          className={cn(
                            'w-full p-3 rounded-lg text-left transition-colors',
                            selectedSession?.id === session.id
                              ? 'bg-secondary'
                              : 'hover:bg-secondary/50'
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm text-foreground">
                              {session.patientName || 'Unknown Caller'}
                            </span>
                            <Badge variant="outline" className={cn('text-xs capitalize', statusStyles[session.status])}>
                              {session.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(session.startTime, session.endTime)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Globe className="h-3 w-3" />
                              {languageLabels[session.language]}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {session.messages.length}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {formatTime(session.startTime)} - {session.messages[session.messages.length - 1]?.content.slice(0, 40)}...
                          </p>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Conversation Detail */}
            <div className="lg:col-span-2">
              {selectedSession ? (
                <Card className="bg-card border-border h-[calc(100vh-160px)] flex flex-col">
                  <CardHeader className="border-b border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                          <Phone className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-semibold">
                            {selectedSession.patientName || 'Unknown Caller'}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {selectedSession.startTime.toLocaleDateString()} at {formatTime(selectedSession.startTime)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-border">
                          <Globe className="h-3 w-3 mr-1" />
                          {languageLabels[selectedSession.language]}
                        </Badge>
                        <Badge variant="outline" className="border-primary text-primary font-mono">
                          {selectedSession.latencyMs || '--'}ms avg
                        </Badge>
                        <Badge variant="outline" className={cn('capitalize', statusStyles[selectedSession.status])}>
                          {selectedSession.status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-hidden p-0">
                    <ScrollArea className="h-full p-4">
                      <div className="space-y-4">
                        {selectedSession.messages.map((message) => (
                          <div
                            key={message.id}
                            className={cn(
                              'flex gap-3',
                              message.role === 'user' ? 'flex-row-reverse' : ''
                            )}
                          >
                            <div className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                              message.role === 'user' ? 'bg-primary' : 'bg-secondary'
                            )}>
                              {message.role === 'user' ? (
                                <User className="h-4 w-4 text-primary-foreground" />
                              ) : (
                                <Bot className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className={cn(
                              'max-w-[75%] rounded-lg px-4 py-2.5',
                              message.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-secondary-foreground'
                            )}>
                              <p className="text-sm">{message.content}</p>
                              <p className="text-xs mt-1 opacity-70">
                                {formatTime(message.timestamp)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-card border-border h-[calc(100vh-160px)] flex items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Select a conversation to view details</p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
