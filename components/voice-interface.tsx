'use client'

import { useState, useEffect, useRef } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Mic, MicOff, Volume2, Phone, PhoneOff, Globe, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Language } from '@/lib/types'
import { languageLabels } from '@/lib/mock-data'

interface VoiceInterfaceProps {
  onSessionStart?: () => void
  onSessionEnd?: () => void
}

const greetings: Record<Language, string> = {
  en: "Hello! Welcome to HealthCare Clinic. How can I help you today?",
  hi: "नमस्ते! हेल्थकेयर क्लिनिक में आपका स्वागत है। मैं आज आपकी कैसे मदद कर सकता हूं?",
  ta: "வணக்கம்! ஹெல்த்கேர் கிளினிக்கிற்கு வரவேற்கிறோம். இன்று நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?"
}

export function VoiceInterface({ onSessionStart, onSessionEnd }: VoiceInterfaceProps) {
  const [isActive, setIsActive] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [language, setLanguage] = useState<Language>('en')
  const [inputText, setInputText] = useState('')
  const [latency, setLatency] = useState<number | null>(null)
  const [requestStartTime, setRequestStartTime] = useState<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status, setMessages } = useChat({
    id: 'voice-agent',
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { language }
    }),
    onResponse: () => {
      if (requestStartTime) {
        setLatency(Date.now() - requestStartTime)
      }
    }
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const startSession = () => {
    setIsActive(true)
    setMessages([{
      id: `greeting-${Date.now()}`,
      role: 'assistant',
      parts: [{ type: 'text', text: greetings[language] }]
    }])
    setLatency(null)
    onSessionStart?.()
  }

  const endSession = () => {
    setIsActive(false)
    setMessages([])
    setLatency(null)
    setInputText('')
    onSessionEnd?.()
  }

  const handleSend = () => {
    if (!inputText.trim() || !isActive || isLoading) return
    setRequestStartTime(Date.now())
    sendMessage({ text: inputText })
    setInputText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const quickActions = [
    'Book an appointment',
    'Check availability',
    'Reschedule my appointment',
    'Cancel appointment'
  ]

  const handleQuickAction = (action: string) => {
    if (!isActive || isLoading) return
    setRequestStartTime(Date.now())
    sendMessage({ text: action })
  }

  const getMessageText = (message: typeof messages[0]) => {
    if (!message.parts) return ''
    return message.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map(p => p.text)
      .join('')
  }

  return (
    <Card className="bg-card border-border h-full flex flex-col">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base font-semibold">Voice Agent</CardTitle>
            <Badge variant={isActive ? 'default' : 'secondary'} className={isActive ? 'bg-primary text-primary-foreground' : ''}>
              {isActive ? (isLoading ? 'Processing' : 'Active') : 'Idle'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Select value={language} onValueChange={(val) => setLanguage(val as Language)}>
              <SelectTrigger className="w-32 h-8 bg-secondary border-border">
                <Globe className="h-3.5 w-3.5 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{languageLabels.en}</SelectItem>
                <SelectItem value="hi">{languageLabels.hi}</SelectItem>
                <SelectItem value="ta">{languageLabels.ta}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
          {messages.length === 0 && !isActive && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                <Mic className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">Start a voice session to begin</p>
              <p className="text-sm text-muted-foreground mt-1">AI-powered assistant in English, Hindi, and Tamil</p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[80%] rounded-lg px-4 py-2.5',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground'
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{getMessageText(message)}</p>
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex justify-start">
              <div className="bg-secondary rounded-lg px-4 py-2.5">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick actions */}
        {isActive && (
          <div className="px-4 pb-2">
            <p className="text-xs text-muted-foreground mb-2">Quick actions</p>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => (
                <Button
                  key={action}
                  variant="outline"
                  size="sm"
                  className="text-xs border-border hover:bg-secondary"
                  onClick={() => handleQuickAction(action)}
                  disabled={isLoading}
                >
                  {action}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input area */}
        {isActive && (
          <div className="px-4 pb-2">
            <div className="flex gap-2">
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="flex-1 bg-secondary border-border"
                disabled={isLoading}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!inputText.trim() || isLoading}
                className="bg-primary text-primary-foreground"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="border-t border-border p-4">
          <div className="flex items-center justify-between mb-4">
            {latency !== null && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Response time:</span>
                <Badge variant="outline" className="text-xs font-mono border-primary text-primary">
                  {latency}ms
                </Badge>
              </div>
            )}
            {isActive && (
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-8 w-8', isMuted && 'text-destructive')}
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Volume2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            {!isActive ? (
              <Button
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={startSession}
              >
                <Phone className="h-4 w-4 mr-2" />
                Start Voice Session
              </Button>
            ) : (
              <Button
                variant="destructive"
                className="flex-1"
                onClick={endSession}
              >
                <PhoneOff className="h-4 w-4 mr-2" />
                End Session
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
