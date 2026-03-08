export type Language = 'en' | 'hi' | 'ta'

export interface Patient {
  id: string
  name: string
  phone: string
  email: string
  language: Language
  createdAt: Date
}

export interface Doctor {
  id: string
  name: string
  specialization: string
  avatar: string
  availableDays: string[]
  workingHours: { start: string; end: string }
}

export interface Appointment {
  id: string
  patientId: string
  patientName: string
  doctorId: string
  doctorName: string
  specialization: string
  date: string
  time: string
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show'
  language: Language
  notes?: string
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  language: Language
}

export interface VoiceSession {
  id: string
  patientId?: string
  patientName?: string
  status: 'active' | 'completed' | 'failed'
  startTime: Date
  endTime?: Date
  language: Language
  messages: ConversationMessage[]
  latencyMs?: number
}

export interface SystemMetrics {
  avgLatencyMs: number
  totalCalls: number
  successRate: number
  activeConversations: number
  appointmentsToday: number
  appointmentsThisWeek: number
}

export interface OutboundCampaign {
  id: string
  name: string
  type: 'reminder' | 'follow-up' | 'confirmation'
  status: 'active' | 'paused' | 'completed'
  targetCount: number
  completedCount: number
  scheduledTime: string
}
