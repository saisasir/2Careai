// Appointment Scheduling Engine
// Handles: booking, rescheduling, cancellation, conflict detection, availability

export interface Doctor {
  id: string
  name: string
  specialty: string
  languages: ('en' | 'hi' | 'ta')[]
  availableSlots: {
    [date: string]: string[] // date -> available time slots
  }
}

export interface Appointment {
  id: string
  patientId: string
  patientName: string
  patientPhone: string
  doctorId: string
  doctorName: string
  specialty: string
  date: string
  time: string
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show'
  language: 'en' | 'hi' | 'ta'
  notes?: string
  createdAt: Date
  updatedAt: Date
}

// In-memory stores
const doctors: Map<string, Doctor> = new Map()
const appointments: Map<string, Appointment> = new Map()

// Initialize doctors with availability
const initDoctors: Doctor[] = [
  {
    id: 'doc-1',
    name: 'Dr. Priya Sharma',
    specialty: 'Cardiologist',
    languages: ['en', 'hi'],
    availableSlots: {}
  },
  {
    id: 'doc-2',
    name: 'Dr. Rajesh Kumar',
    specialty: 'Dermatologist',
    languages: ['en', 'hi', 'ta'],
    availableSlots: {}
  },
  {
    id: 'doc-3',
    name: 'Dr. Anitha Rajan',
    specialty: 'General Physician',
    languages: ['en', 'ta'],
    availableSlots: {}
  },
  {
    id: 'doc-4',
    name: 'Dr. Mohammed Ali',
    specialty: 'Orthopedic',
    languages: ['en', 'hi'],
    availableSlots: {}
  },
  {
    id: 'doc-5',
    name: 'Dr. Kavitha Sundaram',
    specialty: 'Pediatrician',
    languages: ['en', 'hi', 'ta'],
    availableSlots: {}
  }
]

// Generate available slots for next 14 days
function generateAvailableSlots(): { [date: string]: string[] } {
  const slots: { [date: string]: string[] } = {}
  const baseSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30']
  
  for (let i = 0; i < 14; i++) {
    const date = new Date()
    date.setDate(date.getDate() + i)
    const dateStr = date.toISOString().split('T')[0]
    // Randomly remove some slots to simulate bookings
    slots[dateStr] = baseSlots.filter(() => Math.random() > 0.2)
  }
  
  return slots
}

// Initialize doctors
initDoctors.forEach(doc => {
  doc.availableSlots = generateAvailableSlots()
  doctors.set(doc.id, doc)
})

// Initialize some sample appointments
const sampleAppointments: Appointment[] = [
  {
    id: 'apt-1',
    patientId: 'patient-1',
    patientName: 'Rahul Sharma',
    patientPhone: '+91 98765 43210',
    doctorId: 'doc-1',
    doctorName: 'Dr. Priya Sharma',
    specialty: 'Cardiologist',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    status: 'scheduled',
    language: 'hi',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'apt-2',
    patientId: 'patient-2',
    patientName: 'Lakshmi Iyer',
    patientPhone: '+91 98765 43211',
    doctorId: 'doc-3',
    doctorName: 'Dr. Anitha Rajan',
    specialty: 'General Physician',
    date: new Date().toISOString().split('T')[0],
    time: '14:30',
    status: 'confirmed',
    language: 'ta',
    createdAt: new Date(),
    updatedAt: new Date()
  }
]

sampleAppointments.forEach(apt => appointments.set(apt.id, apt))

// Doctor Functions
export function getAllDoctors(): Doctor[] {
  return Array.from(doctors.values())
}

export function getDoctorById(id: string): Doctor | undefined {
  return doctors.get(id)
}

export function getDoctorsBySpecialty(specialty: string): Doctor[] {
  return Array.from(doctors.values()).filter(
    doc => doc.specialty.toLowerCase().includes(specialty.toLowerCase())
  )
}

export function getDoctorsByLanguage(language: 'en' | 'hi' | 'ta'): Doctor[] {
  return Array.from(doctors.values()).filter(
    doc => doc.languages.includes(language)
  )
}

// Availability Functions
export function checkAvailability(doctorId: string, date: string): string[] {
  const doctor = doctors.get(doctorId)
  if (!doctor) return []
  
  const slots = doctor.availableSlots[date] || []
  
  // Filter out already booked slots
  const bookedSlots = Array.from(appointments.values())
    .filter(apt => apt.doctorId === doctorId && apt.date === date && apt.status !== 'cancelled')
    .map(apt => apt.time)
  
  return slots.filter(slot => !bookedSlots.includes(slot))
}

export function getNextAvailableSlots(doctorId: string, count: number = 3): Array<{ date: string, time: string }> {
  const doctor = doctors.get(doctorId)
  if (!doctor) return []
  
  const result: Array<{ date: string, time: string }> = []
  const dates = Object.keys(doctor.availableSlots).sort()
  
  for (const date of dates) {
    if (result.length >= count) break
    const availableSlots = checkAvailability(doctorId, date)
    for (const time of availableSlots) {
      if (result.length >= count) break
      result.push({ date, time })
    }
  }
  
  return result
}

// Appointment Functions
export function getAllAppointments(): Appointment[] {
  return Array.from(appointments.values())
}

export function getAppointmentById(id: string): Appointment | undefined {
  return appointments.get(id)
}

export function getAppointmentsByPatient(patientId: string): Appointment[] {
  return Array.from(appointments.values()).filter(apt => apt.patientId === patientId)
}

export function getAppointmentsByDoctor(doctorId: string): Appointment[] {
  return Array.from(appointments.values()).filter(apt => apt.doctorId === doctorId)
}

export function getAppointmentsByDate(date: string): Appointment[] {
  return Array.from(appointments.values()).filter(apt => apt.date === date)
}

export interface BookingResult {
  success: boolean
  appointment?: Appointment
  error?: string
  alternatives?: Array<{ date: string, time: string }>
}

export function bookAppointment(
  patientId: string,
  patientName: string,
  patientPhone: string,
  doctorId: string,
  date: string,
  time: string,
  language: 'en' | 'hi' | 'ta',
  notes?: string
): BookingResult {
  const doctor = doctors.get(doctorId)
  if (!doctor) {
    return { success: false, error: 'Doctor not found' }
  }
  
  // Check if slot is in the past
  const appointmentDate = new Date(`${date}T${time}:00`)
  if (appointmentDate < new Date()) {
    return { success: false, error: 'Cannot book appointments in the past' }
  }
  
  // Check availability
  const availableSlots = checkAvailability(doctorId, date)
  if (!availableSlots.includes(time)) {
    // Slot not available, suggest alternatives
    const alternatives = getNextAvailableSlots(doctorId, 3)
    return {
      success: false,
      error: 'Requested slot is not available',
      alternatives
    }
  }
  
  // Check for conflicts (same patient, same time)
  const existingAppointment = Array.from(appointments.values()).find(
    apt => apt.patientId === patientId && apt.date === date && apt.time === time && apt.status !== 'cancelled'
  )
  if (existingAppointment) {
    return { success: false, error: 'You already have an appointment at this time' }
  }
  
  // Create appointment
  const appointment: Appointment = {
    id: `apt-${Date.now()}`,
    patientId,
    patientName,
    patientPhone,
    doctorId,
    doctorName: doctor.name,
    specialty: doctor.specialty,
    date,
    time,
    status: 'scheduled',
    language,
    notes,
    createdAt: new Date(),
    updatedAt: new Date()
  }
  
  appointments.set(appointment.id, appointment)
  
  return { success: true, appointment }
}

export function cancelAppointment(appointmentId: string): BookingResult {
  const appointment = appointments.get(appointmentId)
  if (!appointment) {
    return { success: false, error: 'Appointment not found' }
  }
  
  if (appointment.status === 'cancelled') {
    return { success: false, error: 'Appointment is already cancelled' }
  }
  
  if (appointment.status === 'completed') {
    return { success: false, error: 'Cannot cancel a completed appointment' }
  }
  
  appointment.status = 'cancelled'
  appointment.updatedAt = new Date()
  appointments.set(appointmentId, appointment)
  
  return { success: true, appointment }
}

export function rescheduleAppointment(
  appointmentId: string,
  newDate: string,
  newTime: string
): BookingResult {
  const appointment = appointments.get(appointmentId)
  if (!appointment) {
    return { success: false, error: 'Appointment not found' }
  }
  
  if (appointment.status === 'cancelled' || appointment.status === 'completed') {
    return { success: false, error: 'Cannot reschedule this appointment' }
  }
  
  // Check if new slot is available
  const availableSlots = checkAvailability(appointment.doctorId, newDate)
  if (!availableSlots.includes(newTime)) {
    const alternatives = getNextAvailableSlots(appointment.doctorId, 3)
    return {
      success: false,
      error: 'Requested slot is not available',
      alternatives
    }
  }
  
  // Check if new time is in the past
  const newAppointmentDate = new Date(`${newDate}T${newTime}:00`)
  if (newAppointmentDate < new Date()) {
    return { success: false, error: 'Cannot reschedule to a past time' }
  }
  
  // Update appointment
  appointment.date = newDate
  appointment.time = newTime
  appointment.updatedAt = new Date()
  appointments.set(appointmentId, appointment)
  
  return { success: true, appointment }
}

export function completeAppointment(appointmentId: string): BookingResult {
  const appointment = appointments.get(appointmentId)
  if (!appointment) {
    return { success: false, error: 'Appointment not found' }
  }
  
  appointment.status = 'completed'
  appointment.updatedAt = new Date()
  appointments.set(appointmentId, appointment)
  
  return { success: true, appointment }
}

export function confirmAppointment(appointmentId: string): BookingResult {
  const appointment = appointments.get(appointmentId)
  if (!appointment) {
    return { success: false, error: 'Appointment not found' }
  }
  
  appointment.status = 'confirmed'
  appointment.updatedAt = new Date()
  appointments.set(appointmentId, appointment)
  
  return { success: true, appointment }
}
