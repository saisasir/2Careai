import { NextRequest, NextResponse } from 'next/server'
import { backendAuthGet, backendAuthPost, backendAuthPatch } from '@/lib/backend-client'
import {
  bookAppointment,
  cancelAppointment,
  rescheduleAppointment,
  completeAppointment,
  confirmAppointment
} from '@/lib/scheduling-engine'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const patientId = searchParams.get('patientId')
  const doctorId = searchParams.get('doctorId')
  const date = searchParams.get('date')
  const status = searchParams.get('status')

  try {
    // Fetch real appointments from backend DB
    const appointments: Array<{
      id: string; patient: string; doctor: string; date: string; time: string; status: string
    }> = await backendAuthGet('/clinic/appointments')

    if (id) {
      const appt = appointments.find(a => String(a.id) === id)
      if (!appt) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
      return NextResponse.json(appt)
    }

    let filtered = appointments
    if (patientId) filtered = filtered.filter(a => (a as Record<string, unknown>).patientId === patientId || a.patient === patientId)
    if (doctorId) filtered = filtered.filter(a => (a as Record<string, unknown>).doctorId === doctorId || a.doctor === doctorId)
    if (date) filtered = filtered.filter(a => a.date === date)
    if (status) filtered = filtered.filter(a => a.status === status)

    filtered.sort((a, b) => {
      const dc = a.date.localeCompare(b.date)
      return dc !== 0 ? dc : a.time.localeCompare(b.time)
    })

    return NextResponse.json(filtered)
  } catch (err) {
    console.error('appointments GET error — falling back to mock:', err)
    // Fallback to local mock if backend unreachable
    const { getAllAppointments, getAppointmentById } = await import('@/lib/scheduling-engine')
    if (id) {
      const appt = getAppointmentById(id)
      return appt
        ? NextResponse.json(appt)
        : NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }
    let appts = getAllAppointments()
    if (patientId) appts = appts.filter(a => a.patientId === patientId)
    if (doctorId) appts = appts.filter(a => a.doctorId === doctorId)
    if (date) appts = appts.filter(a => a.date === date)
    if (status) appts = appts.filter(a => a.status === status)
    appts.sort((a, b) => {
      const dc = a.date.localeCompare(b.date)
      return dc !== 0 ? dc : a.time.localeCompare(b.time)
    })
    return NextResponse.json(appts)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { patientId, patientName, patientPhone, doctorId, date, time, language, notes } = body

    if (!patientId || !patientName || !patientPhone || !doctorId || !date || !time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Try to create via backend REST endpoint first
    try {
      const result = await backendAuthPost('/clinic/appointments', {
        patient_name: patientName,
        patient_phone: patientPhone,
        doctor_id: doctorId,
        appointment_date: date,
        start_time: time,
        language_used: language || 'en',
        notes
      })
      return NextResponse.json(result, { status: 201 })
    } catch {
      // Fallback to in-memory mock if backend endpoint not available
      const result = bookAppointment(
        patientId, patientName, patientPhone, doctorId, date, time,
        language || 'en', notes
      )
      if (!result.success) {
        return NextResponse.json({ error: result.error, alternatives: result.alternatives }, { status: 400 })
      }
      return NextResponse.json(result.appointment, { status: 201 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, action, newDate, newTime } = body

    if (!id || !action) {
      return NextResponse.json({ error: 'Missing id or action' }, { status: 400 })
    }

    // Try backend PATCH first
    try {
      const result = await backendAuthPatch(`/clinic/appointments/${id}`, { action, newDate, newTime })
      return NextResponse.json(result)
    } catch {
      // Fallback to mock
      let result
      switch (action) {
        case 'cancel': result = cancelAppointment(id); break
        case 'complete': result = completeAppointment(id); break
        case 'confirm': result = confirmAppointment(id); break
        case 'reschedule':
          if (!newDate || !newTime) {
            return NextResponse.json({ error: 'newDate and newTime required for reschedule' }, { status: 400 })
          }
          result = rescheduleAppointment(id, newDate, newTime)
          break
        default:
          return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
      }
      if (!result.success) {
        return NextResponse.json({ error: result.error, alternatives: result.alternatives }, { status: 400 })
      }
      return NextResponse.json(result.appointment)
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
