import { streamText, convertToModelMessages, UIMessage, tool } from 'ai'
import { z } from 'zod'
import { detectLanguage } from '@/lib/language-detector'
import { 
  getAllDoctors, 
  getDoctorsBySpecialty, 
  checkAvailability, 
  getNextAvailableSlots,
  bookAppointment,
  cancelAppointment,
  rescheduleAppointment,
  getAppointmentsByPatient
} from '@/lib/scheduling-engine'
import { 
  getSession, 
  createSession, 
  updateSession, 
  addMessageToSession
} from '@/lib/memory-store'
import { recordLatency } from '@/lib/latency-tracker'

export async function POST(req: Request) {
  const startTime = Date.now()
  
  const { messages, language: clientLanguage, sessionId = `session-${Date.now()}`, patientId } = await req.json() as { 
    messages: UIMessage[], 
    language?: string,
    sessionId?: string,
    patientId?: string
  }

  // Get or create session
  let session = getSession(sessionId)
  if (!session) {
    session = createSession(sessionId, (clientLanguage as 'en' | 'hi' | 'ta') || 'en')
  }

  // Detect language from latest message if not provided
  const lastMessage = messages[messages.length - 1]
  const lastMessageText = lastMessage?.parts?.find((p: { type: string }) => p.type === 'text')?.text || ''
  const detectedLang = detectLanguage(lastMessageText)
  const language = clientLanguage || detectedLang.language
  
  const langDetectTime = Date.now() - startTime

  // Update session
  if (session.language !== language) {
    updateSession(sessionId, { language: language as 'en' | 'hi' | 'ta' })
  }
  addMessageToSession(sessionId, 'user', lastMessageText)

  const languageInstructions: Record<string, string> = {
    en: 'Respond in English. Be concise and conversational.',
    hi: 'Respond in Hindi (हिंदी) using Devanagari script. Be concise and conversational.',
    ta: 'Respond in Tamil (தமிழ்) using Tamil script. Be concise and conversational.'
  }

  const systemPrompt = `You are a helpful AI voice assistant for HealthCare Clinic, assisting patients with appointments.

${languageInstructions[language] || languageInstructions.en}

You have tools to:
- List available doctors (listDoctors)
- Check appointment availability (checkAvailability)
- Book appointments (bookAppointment)
- Cancel appointments (cancelAppointment)
- Reschedule appointments (rescheduleAppointment)

Guidelines:
- Keep responses brief (this is a voice conversation)
- Always confirm before booking/canceling
- Suggest alternatives if slot unavailable
- Be warm and professional`

  const tools = {
    listDoctors: tool({
      description: 'Get list of available doctors, optionally by specialty',
      inputSchema: z.object({
        specialty: z.string().optional()
      }),
      execute: async ({ specialty }) => {
        const doctors = specialty ? getDoctorsBySpecialty(specialty) : getAllDoctors()
        return doctors.map(d => ({ id: d.id, name: d.name, specialty: d.specialty }))
      }
    }),
    
    checkAvailability: tool({
      description: 'Check available slots for a doctor on a date',
      inputSchema: z.object({
        doctorId: z.string(),
        date: z.string().describe('YYYY-MM-DD format')
      }),
      execute: async ({ doctorId, date }) => {
        const slots = checkAvailability(doctorId, date)
        if (slots.length === 0) {
          return { available: false, nextAvailable: getNextAvailableSlots(doctorId, 3) }
        }
        return { available: true, slots }
      }
    }),
    
    bookAppointment: tool({
      description: 'Book an appointment',
      inputSchema: z.object({
        doctorId: z.string(),
        date: z.string(),
        time: z.string(),
        patientName: z.string(),
        patientPhone: z.string()
      }),
      execute: async ({ doctorId, date, time, patientName, patientPhone }) => {
        return bookAppointment(
          patientId || `patient-${Date.now()}`,
          patientName,
          patientPhone,
          doctorId,
          date,
          time,
          language as 'en' | 'hi' | 'ta'
        )
      }
    }),
    
    cancelAppointment: tool({
      description: 'Cancel an appointment',
      inputSchema: z.object({
        appointmentId: z.string()
      }),
      execute: async ({ appointmentId }) => cancelAppointment(appointmentId)
    }),
    
    rescheduleAppointment: tool({
      description: 'Reschedule an appointment',
      inputSchema: z.object({
        appointmentId: z.string(),
        newDate: z.string(),
        newTime: z.string()
      }),
      execute: async ({ appointmentId, newDate, newTime }) => 
        rescheduleAppointment(appointmentId, newDate, newTime)
    }),
    
    getMyAppointments: tool({
      description: 'Get patient appointments',
      inputSchema: z.object({
        patientId: z.string()
      }),
      execute: async ({ patientId: pid }) => getAppointmentsByPatient(pid)
    })
  }

  const agentStartTime = Date.now()

  const result = streamText({
    model: 'groq/llama-3.3-70b-versatile',
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools,
    maxSteps: 5,
    onFinish: ({ text }) => {
      const endTime = Date.now()
      const agentLatency = endTime - agentStartTime
      
      recordLatency({
        sessionId,
        timestamp: new Date(),
        stages: {
          sttLatency: 80,
          languageDetection: langDetectTime,
          agentLatency,
          toolExecution: 25,
          ttsLatency: 70
        },
        totalLatency: endTime - startTime
      })
      
      addMessageToSession(sessionId, 'assistant', text)
    }
  })

  return result.toUIMessageStreamResponse()
}
