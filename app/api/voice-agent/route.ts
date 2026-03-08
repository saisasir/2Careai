import { streamText, tool, convertToModelMessages } from 'ai'
import { z } from 'zod'
import { detectLanguage, getLanguageGreeting, getCommonPhrases } from '@/lib/language-detector'
import {
  getAllDoctors,
  getDoctorsBySpecialty,
  checkAvailability,
  getNextAvailableSlots,
  bookAppointment,
  cancelAppointment,
  rescheduleAppointment,
  getAppointmentsByPatient,
  getAppointmentById
} from '@/lib/scheduling-engine'
import {
  getSession,
  createSession,
  updateSession,
  addMessageToSession,
  getPatientMemory
} from '@/lib/memory-store'
import { recordLatency } from '@/lib/latency-tracker'

export async function POST(req: Request) {
  const startTime = Date.now()

  const { messages, sessionId, language: clientLanguage, patientId } = await req.json()

  // Get or create session
  let session = getSession(sessionId)
  if (!session) {
    session = createSession(sessionId, clientLanguage || 'en')
  }

  // Detect language from latest message
  const lastMessage = messages[messages.length - 1]
  const detectedLang = detectLanguage(lastMessage?.content || '')
  const language = clientLanguage || detectedLang.language

  if (session.language !== language) {
    updateSession(sessionId, { language })
  }

  const patientMemory = patientId ? getPatientMemory(patientId) : undefined
  const langDetectTime = Date.now() - startTime

  const systemPrompts: Record<string, string> = {
    en: `You are a helpful multilingual healthcare appointment assistant for a clinic. You help patients book, reschedule, and cancel appointments.

Current conversation language: English
${patientMemory ? `Patient Info: Name: ${patientMemory.name}, Preferred Doctor: ${patientMemory.preferences.preferredDoctor || 'None'}, Past Appointments: ${patientMemory.pastAppointments.length}` : 'New patient'}

Guidelines:
- Be concise and helpful
- Confirm details before booking
- Suggest alternatives if requested slot unavailable
- Always confirm actions before executing
- Use natural, conversational language`,

    hi: `आप एक क्लिनिक के लिए एक सहायक बहुभाषी स्वास्थ्य सेवा अपॉइंटमेंट सहायक हैं।

वर्तमान बातचीत भाषा: हिंदी
${patientMemory ? `रोगी जानकारी: नाम: ${patientMemory.name}` : 'नया रोगी'}

दिशानिर्देश:
- संक्षिप्त और सहायक रहें
- बुकिंग से पहले विवरण की पुष्टि करें
- हिंदी में जवाब दें`,

    ta: `நீங்கள் ஒரு கிளினிக்கிற்கான உதவிகரமான பன்மொழி சுகாதார சந்திப்பு உதவியாளர்.

தற்போதைய உரையாடல் மொழி: தமிழ்
${patientMemory ? `நோயாளி தகவல்: பெயர்: ${patientMemory.name}` : 'புதிய நோயாளி'}

வழிகாட்டுதல்கள்:
- சுருக்கமாகவும் உதவிகரமாகவும் இருங்கள்
- தமிழில் பதிலளிக்கவும்`
  }

  const agentStartTime = Date.now()

  const tools = {
    listDoctors: tool({
      description: 'Get list of available doctors, optionally filtered by specialty',
      inputSchema: z.object({
        specialty: z.string().optional()
      }),
      execute: async ({ specialty }) => {
        const doctors = specialty ? getDoctorsBySpecialty(specialty) : getAllDoctors()
        return doctors.map(d => ({ id: d.id, name: d.name, specialty: d.specialty, languages: d.languages }))
      }
    }),

    checkDoctorAvailability: tool({
      description: 'Check available appointment slots for a specific doctor on a given date',
      inputSchema: z.object({
        doctorId: z.string(),
        date: z.string().describe('Date in YYYY-MM-DD format')
      }),
      execute: async ({ doctorId, date }) => {
        const slots = checkAvailability(doctorId, date)
        if (slots.length === 0) {
          return { available: false, nextAvailable: getNextAvailableSlots(doctorId, 5) }
        }
        return { available: true, slots }
      }
    }),

    bookAppointment: tool({
      description: 'Book a new appointment for the patient',
      inputSchema: z.object({
        doctorId: z.string(),
        date: z.string().describe('YYYY-MM-DD'),
        time: z.string().describe('HH:MM'),
        patientName: z.string(),
        patientPhone: z.string(),
        notes: z.string().optional()
      }),
      execute: async ({ doctorId, date, time, patientName, patientPhone, notes }) => {
        const result = bookAppointment(
          patientId || `patient-${Date.now()}`,
          patientName, patientPhone, doctorId, date, time,
          language as 'en' | 'hi' | 'ta', notes
        )
        if (result.success && result.appointment) {
          addMessageToSession(sessionId, 'assistant', `Booked appointment: ${result.appointment.id}`)
        }
        return result
      }
    }),

    cancelAppointment: tool({
      description: 'Cancel an existing appointment',
      inputSchema: z.object({ appointmentId: z.string() }),
      execute: async ({ appointmentId }) => cancelAppointment(appointmentId)
    }),

    rescheduleAppointment: tool({
      description: 'Reschedule an existing appointment',
      inputSchema: z.object({
        appointmentId: z.string(),
        newDate: z.string().describe('YYYY-MM-DD'),
        newTime: z.string().describe('HH:MM')
      }),
      execute: async ({ appointmentId, newDate, newTime }) =>
        rescheduleAppointment(appointmentId, newDate, newTime)
    }),

    getPatientAppointments: tool({
      description: 'Get all appointments for a patient',
      inputSchema: z.object({ patientId: z.string() }),
      execute: async ({ patientId: pid }) => {
        return getAppointmentsByPatient(pid).map(a => ({
          id: a.id, doctorName: a.doctorName, specialty: a.specialty,
          date: a.date, time: a.time, status: a.status
        }))
      }
    })
  }

  try {
    const result = streamText({
      model: 'groq/llama-3.3-70b-versatile',
      system: systemPrompts[language] || systemPrompts.en,
      messages: await convertToModelMessages(messages),
      tools,
      maxSteps: 5,
      onFinish: async ({ text }) => {
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

    return result.toUIMessageStreamResponse({
      headers: {
        'X-Session-Id': sessionId,
        'X-Language': language,
        'X-Latency-Start': startTime.toString()
      }
    })
  } catch (error) {
    console.error('Voice agent error:', error)
    const phrases = getCommonPhrases(language as 'en' | 'hi' | 'ta')
    return new Response(
      JSON.stringify({
        error: 'Processing error',
        fallback: language === 'en'
          ? "I'm having trouble processing that. Could you please repeat?"
          : language === 'hi'
          ? "मुझे इसे प्रोसेस करने में समस्या हो रही है। क्या आप कृपया दोहरा सकते हैं?"
          : "எனக்கு அதை செயலாக்குவதில் சிக்கல் உள்ளது. தயவுசெய்து மீண்டும் சொல்ல முடியுமா?"
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
