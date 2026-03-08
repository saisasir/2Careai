// In-memory store (would be Redis in production)
// Session Memory - current conversation context
// Persistent Memory - long-term user history

export interface SessionMemory {
  sessionId: string
  patientId?: string
  language: 'en' | 'hi' | 'ta'
  conversationState: {
    intent?: 'book' | 'cancel' | 'reschedule' | 'check_availability' | 'general'
    doctorType?: string
    doctorId?: string
    date?: string
    time?: string
    pendingConfirmation?: boolean
  }
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
  }>
  createdAt: Date
  updatedAt: Date
}

export interface PersistentMemory {
  patientId: string
  name: string
  phone: string
  preferredLanguage: 'en' | 'hi' | 'ta'
  pastAppointments: Array<{
    appointmentId: string
    doctorId: string
    doctorName: string
    date: string
    status: string
  }>
  preferences: {
    preferredHospital?: string
    preferredDoctor?: string
    preferredTimeSlot?: 'morning' | 'afternoon' | 'evening'
  }
  createdAt: Date
  updatedAt: Date
}

// In-memory stores (would be Redis in production)
const sessionStore = new Map<string, SessionMemory>()
const persistentStore = new Map<string, PersistentMemory>()

// Session Memory Functions
export function createSession(sessionId: string, language: 'en' | 'hi' | 'ta' = 'en'): SessionMemory {
  const session: SessionMemory = {
    sessionId,
    language,
    conversationState: {},
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date()
  }
  sessionStore.set(sessionId, session)
  return session
}

export function getSession(sessionId: string): SessionMemory | undefined {
  return sessionStore.get(sessionId)
}

export function updateSession(sessionId: string, updates: Partial<SessionMemory>): SessionMemory | undefined {
  const session = sessionStore.get(sessionId)
  if (!session) return undefined
  
  const updated = {
    ...session,
    ...updates,
    updatedAt: new Date()
  }
  sessionStore.set(sessionId, updated)
  return updated
}

export function addMessageToSession(sessionId: string, role: 'user' | 'assistant', content: string) {
  const session = sessionStore.get(sessionId)
  if (!session) return
  
  session.messages.push({
    role,
    content,
    timestamp: new Date()
  })
  session.updatedAt = new Date()
  sessionStore.set(sessionId, session)
}

export function deleteSession(sessionId: string) {
  sessionStore.delete(sessionId)
}

// Persistent Memory Functions
export function getPatientMemory(patientId: string): PersistentMemory | undefined {
  return persistentStore.get(patientId)
}

export function createPatientMemory(patient: Omit<PersistentMemory, 'createdAt' | 'updatedAt'>): PersistentMemory {
  const memory: PersistentMemory = {
    ...patient,
    createdAt: new Date(),
    updatedAt: new Date()
  }
  persistentStore.set(patient.patientId, memory)
  return memory
}

export function updatePatientMemory(patientId: string, updates: Partial<PersistentMemory>): PersistentMemory | undefined {
  const memory = persistentStore.get(patientId)
  if (!memory) return undefined
  
  const updated = {
    ...memory,
    ...updates,
    updatedAt: new Date()
  }
  persistentStore.set(patientId, updated)
  return updated
}

export function addAppointmentToHistory(patientId: string, appointment: PersistentMemory['pastAppointments'][0]) {
  const memory = persistentStore.get(patientId)
  if (!memory) return
  
  memory.pastAppointments.push(appointment)
  memory.updatedAt = new Date()
  persistentStore.set(patientId, memory)
}

// Initialize some sample patient data
createPatientMemory({
  patientId: 'patient-1',
  name: 'Rahul Sharma',
  phone: '+91 98765 43210',
  preferredLanguage: 'hi',
  pastAppointments: [
    { appointmentId: 'apt-1', doctorId: 'doc-1', doctorName: 'Dr. Priya Sharma', date: '2024-01-15', status: 'completed' }
  ],
  preferences: { preferredDoctor: 'Dr. Priya Sharma', preferredTimeSlot: 'morning' }
})

createPatientMemory({
  patientId: 'patient-2',
  name: 'Lakshmi Iyer',
  phone: '+91 98765 43211',
  preferredLanguage: 'ta',
  pastAppointments: [],
  preferences: { preferredTimeSlot: 'afternoon' }
})

createPatientMemory({
  patientId: 'patient-3',
  name: 'John Smith',
  phone: '+91 98765 43212',
  preferredLanguage: 'en',
  pastAppointments: [],
  preferences: {}
})

// Get all sessions (for dashboard)
export function getAllSessions(): SessionMemory[] {
  return Array.from(sessionStore.values())
}

// Get all patients (for dashboard)
export function getAllPatients(): PersistentMemory[] {
  return Array.from(persistentStore.values())
}
