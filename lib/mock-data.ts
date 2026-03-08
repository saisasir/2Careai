import type { Patient, Doctor, Appointment, VoiceSession, SystemMetrics, OutboundCampaign, Language } from './types'

export const doctors: Doctor[] = [
  {
    id: 'doc-1',
    name: 'Dr. Priya Sharma',
    specialization: 'General Physician',
    avatar: '/avatars/doctor-1.jpg',
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    workingHours: { start: '09:00', end: '17:00' }
  },
  {
    id: 'doc-2',
    name: 'Dr. Rajesh Kumar',
    specialization: 'Cardiologist',
    avatar: '/avatars/doctor-2.jpg',
    availableDays: ['Monday', 'Wednesday', 'Friday'],
    workingHours: { start: '10:00', end: '18:00' }
  },
  {
    id: 'doc-3',
    name: 'Dr. Anitha Rajan',
    specialization: 'Dermatologist',
    avatar: '/avatars/doctor-3.jpg',
    availableDays: ['Tuesday', 'Thursday', 'Saturday'],
    workingHours: { start: '08:00', end: '14:00' }
  },
  {
    id: 'doc-4',
    name: 'Dr. Vikram Patel',
    specialization: 'Orthopedic',
    avatar: '/avatars/doctor-4.jpg',
    availableDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
    workingHours: { start: '11:00', end: '19:00' }
  },
  {
    id: 'doc-5',
    name: 'Dr. Lakshmi Nair',
    specialization: 'Pediatrician',
    avatar: '/avatars/doctor-5.jpg',
    availableDays: ['Monday', 'Wednesday', 'Friday', 'Saturday'],
    workingHours: { start: '09:00', end: '15:00' }
  }
]

export const patients: Patient[] = [
  { id: 'pat-1', name: 'Amit Verma', phone: '+91 98765 43210', email: 'amit.verma@email.com', language: 'en', createdAt: new Date('2024-01-15') },
  { id: 'pat-2', name: 'Sunita Devi', phone: '+91 87654 32109', email: 'sunita.devi@email.com', language: 'hi', createdAt: new Date('2024-02-20') },
  { id: 'pat-3', name: 'Murugan S', phone: '+91 76543 21098', email: 'murugan.s@email.com', language: 'ta', createdAt: new Date('2024-03-10') },
  { id: 'pat-4', name: 'Ramesh Gupta', phone: '+91 65432 10987', email: 'ramesh.g@email.com', language: 'en', createdAt: new Date('2024-04-05') },
  { id: 'pat-5', name: 'Kavitha M', phone: '+91 54321 09876', email: 'kavitha.m@email.com', language: 'ta', createdAt: new Date('2024-05-12') },
]

export const appointments: Appointment[] = [
  { id: 'apt-1', patientId: 'pat-1', patientName: 'Amit Verma', doctorId: 'doc-1', doctorName: 'Dr. Priya Sharma', specialization: 'General Physician', date: '2026-03-07', time: '10:00', status: 'scheduled', language: 'en' },
  { id: 'apt-2', patientId: 'pat-2', patientName: 'Sunita Devi', doctorId: 'doc-2', doctorName: 'Dr. Rajesh Kumar', specialization: 'Cardiologist', date: '2026-03-07', time: '11:30', status: 'scheduled', language: 'hi' },
  { id: 'apt-3', patientId: 'pat-3', patientName: 'Murugan S', doctorId: 'doc-3', doctorName: 'Dr. Anitha Rajan', specialization: 'Dermatologist', date: '2026-03-07', time: '14:00', status: 'completed', language: 'ta' },
  { id: 'apt-4', patientId: 'pat-4', patientName: 'Ramesh Gupta', doctorId: 'doc-4', doctorName: 'Dr. Vikram Patel', specialization: 'Orthopedic', date: '2026-03-08', time: '11:00', status: 'scheduled', language: 'en' },
  { id: 'apt-5', patientId: 'pat-5', patientName: 'Kavitha M', doctorId: 'doc-5', doctorName: 'Dr. Lakshmi Nair', specialization: 'Pediatrician', date: '2026-03-08', time: '09:30', status: 'scheduled', language: 'ta' },
  { id: 'apt-6', patientId: 'pat-1', patientName: 'Amit Verma', doctorId: 'doc-2', doctorName: 'Dr. Rajesh Kumar', specialization: 'Cardiologist', date: '2026-03-06', time: '15:00', status: 'completed', language: 'en' },
  { id: 'apt-7', patientId: 'pat-2', patientName: 'Sunita Devi', doctorId: 'doc-1', doctorName: 'Dr. Priya Sharma', specialization: 'General Physician', date: '2026-03-05', time: '10:30', status: 'cancelled', language: 'hi' },
  { id: 'apt-8', patientId: 'pat-3', patientName: 'Murugan S', doctorId: 'doc-4', doctorName: 'Dr. Vikram Patel', specialization: 'Orthopedic', date: '2026-03-09', time: '16:00', status: 'scheduled', language: 'ta' },
]

export const voiceSessions: VoiceSession[] = [
  {
    id: 'vs-1',
    patientId: 'pat-1',
    patientName: 'Amit Verma',
    status: 'completed',
    startTime: new Date('2026-03-07T09:30:00'),
    endTime: new Date('2026-03-07T09:33:45'),
    language: 'en',
    latencyMs: 312,
    messages: [
      { id: 'm1', role: 'assistant', content: 'Hello! Welcome to HealthCare Clinic. How can I help you today?', timestamp: new Date('2026-03-07T09:30:00'), language: 'en' },
      { id: 'm2', role: 'user', content: 'I would like to book an appointment with a general physician.', timestamp: new Date('2026-03-07T09:30:15'), language: 'en' },
      { id: 'm3', role: 'assistant', content: 'I can help you with that. Dr. Priya Sharma is available. Would you prefer tomorrow at 10:00 AM or 2:00 PM?', timestamp: new Date('2026-03-07T09:30:18'), language: 'en' },
      { id: 'm4', role: 'user', content: '10 AM works for me.', timestamp: new Date('2026-03-07T09:30:35'), language: 'en' },
      { id: 'm5', role: 'assistant', content: 'I have booked your appointment with Dr. Priya Sharma for tomorrow at 10:00 AM. You will receive a confirmation SMS shortly. Is there anything else I can help you with?', timestamp: new Date('2026-03-07T09:30:38'), language: 'en' },
    ]
  },
  {
    id: 'vs-2',
    patientId: 'pat-2',
    patientName: 'Sunita Devi',
    status: 'completed',
    startTime: new Date('2026-03-07T10:15:00'),
    endTime: new Date('2026-03-07T10:19:30'),
    language: 'hi',
    latencyMs: 287,
    messages: [
      { id: 'm1', role: 'assistant', content: 'नमस्ते! हेल्थकेयर क्लिनिक में आपका स्वागत है। मैं आपकी कैसे मदद कर सकता हूं?', timestamp: new Date('2026-03-07T10:15:00'), language: 'hi' },
      { id: 'm2', role: 'user', content: 'मुझे हृदय रोग विशेषज्ञ से मिलना है।', timestamp: new Date('2026-03-07T10:15:20'), language: 'hi' },
      { id: 'm3', role: 'assistant', content: 'डॉ. राजेश कुमार हमारे हृदय रोग विशेषज्ञ हैं। वे आज 11:30 बजे उपलब्ध हैं। क्या आप इस समय के लिए अपॉइंटमेंट बुक करना चाहेंगे?', timestamp: new Date('2026-03-07T10:15:24'), language: 'hi' },
      { id: 'm4', role: 'user', content: 'हां, यह समय ठीक है।', timestamp: new Date('2026-03-07T10:15:45'), language: 'hi' },
      { id: 'm5', role: 'assistant', content: 'आपका अपॉइंटमेंट डॉ. राजेश कुमार के साथ आज 11:30 बजे के लिए बुक हो गया है। आपको जल्द ही SMS पर पुष्टि मिल जाएगी।', timestamp: new Date('2026-03-07T10:15:48'), language: 'hi' },
    ]
  },
  {
    id: 'vs-3',
    patientId: 'pat-3',
    patientName: 'Murugan S',
    status: 'active',
    startTime: new Date('2026-03-07T11:00:00'),
    language: 'ta',
    latencyMs: 298,
    messages: [
      { id: 'm1', role: 'assistant', content: 'வணக்கம்! ஹெல்த்கேர் கிளினிக்கிற்கு வரவேற்கிறோம். நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?', timestamp: new Date('2026-03-07T11:00:00'), language: 'ta' },
      { id: 'm2', role: 'user', content: 'என் அப்பாயிண்ட்மெண்ட்டை மாற்ற வேண்டும்.', timestamp: new Date('2026-03-07T11:00:18'), language: 'ta' },
    ]
  }
]

export const systemMetrics: SystemMetrics = {
  avgLatencyMs: 298,
  totalCalls: 1247,
  successRate: 94.2,
  activeConversations: 3,
  appointmentsToday: 24,
  appointmentsThisWeek: 156
}

export const outboundCampaigns: OutboundCampaign[] = [
  { id: 'camp-1', name: 'Tomorrow Reminders', type: 'reminder', status: 'active', targetCount: 24, completedCount: 18, scheduledTime: '18:00' },
  { id: 'camp-2', name: 'Follow-up Calls', type: 'follow-up', status: 'active', targetCount: 15, completedCount: 8, scheduledTime: '10:00' },
  { id: 'camp-3', name: 'Confirmation Calls', type: 'confirmation', status: 'paused', targetCount: 32, completedCount: 32, scheduledTime: '09:00' },
]

export const availableSlots = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
]

export const languageLabels: Record<Language, string> = {
  en: 'English',
  hi: 'हिंदी',
  ta: 'தமிழ்'
}

export const latencyData = [
  { time: '09:00', latency: 312, calls: 45 },
  { time: '09:30', latency: 287, calls: 52 },
  { time: '10:00', latency: 298, calls: 68 },
  { time: '10:30', latency: 324, calls: 71 },
  { time: '11:00', latency: 301, calls: 64 },
  { time: '11:30', latency: 289, calls: 58 },
  { time: '12:00', latency: 276, calls: 42 },
  { time: '12:30', latency: 265, calls: 38 },
  { time: '13:00', latency: 271, calls: 35 },
  { time: '13:30', latency: 283, calls: 41 },
  { time: '14:00', latency: 295, calls: 56 },
  { time: '14:30', latency: 308, calls: 62 },
  { time: '15:00', latency: 318, calls: 67 },
]
