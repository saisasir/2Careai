import { NextRequest, NextResponse } from 'next/server'
import { backendGet, backendAuthPost } from '@/lib/backend-client'
import {
  getDoctorsBySpecialty,
  getDoctorsByLanguage,
  checkAvailability,
  getNextAvailableSlots
} from '@/lib/scheduling-engine'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const specialty = searchParams.get('specialty')
  const language = searchParams.get('language') as 'en' | 'hi' | 'ta' | null
  const checkDate = searchParams.get('checkDate')

  try {
    // Fetch real doctor list from backend DB
    const doctors: Array<{ id: string; name: string; specialty: string; languages: string[] }> =
      await backendGet('/clinic/doctors')

    // Filter by specialty
    let filtered = specialty
      ? doctors.filter(d => d.specialty.toLowerCase().includes(specialty.toLowerCase()))
      : doctors

    // Filter by language
    if (language) {
      filtered = filtered.filter(d => d.languages?.includes(language))
    }

    // Single doctor lookup
    if (id) {
      const doctor = filtered.find(d => String(d.id) === id) || doctors.find(d => String(d.id) === id)
      if (!doctor) {
        return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
      }

      if (checkDate) {
        // Availability from in-memory engine (uses seeded schedule data)
        const slots = checkAvailability(id, checkDate)
        return NextResponse.json({ ...doctor, availability: { date: checkDate, slots } })
      }

      return NextResponse.json(doctor)
    }

    return NextResponse.json(filtered)
  } catch (err) {
    console.error('doctors GET error:', err)
    // Fallback to local mock if backend is unreachable
    const { getAllDoctors, getDoctorById } = await import('@/lib/scheduling-engine')
    if (id) {
      const doctor = getDoctorById(id)
      return doctor
        ? NextResponse.json(doctor)
        : NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }
    let doctors = getAllDoctors()
    if (specialty) doctors = getDoctorsBySpecialty(specialty)
    if (language) {
      const langDoctors = getDoctorsByLanguage(language)
      doctors = doctors.filter(d => langDoctors.some(ld => ld.id === d.id))
    }
    return NextResponse.json(doctors)
  }
}

// Check availability for a specific doctor
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { doctorId, date, getNext } = body

    if (!doctorId) {
      return NextResponse.json({ error: 'doctorId required' }, { status: 400 })
    }

    // Fetch doctors from backend to validate doctor exists
    const doctors: Array<{ id: string; name: string; specialty: string }> =
      await backendGet('/clinic/doctors')
    const doctor = doctors.find(d => String(d.id) === doctorId)
    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }

    if (getNext) {
      const nextSlots = getNextAvailableSlots(doctorId, getNext)
      return NextResponse.json({
        doctor: { id: doctor.id, name: doctor.name, specialty: doctor.specialty },
        nextAvailable: nextSlots
      })
    }

    if (!date) {
      return NextResponse.json({ error: 'date required' }, { status: 400 })
    }

    const slots = checkAvailability(doctorId, date)
    return NextResponse.json({
      doctor: { id: doctor.id, name: doctor.name, specialty: doctor.specialty },
      date,
      available: slots.length > 0,
      slots
    })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
