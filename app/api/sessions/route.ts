import { NextRequest, NextResponse } from 'next/server'
import { 
  getSession, 
  createSession, 
  updateSession, 
  deleteSession,
  getAllSessions,
  addMessageToSession
} from '@/lib/memory-store'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')

  if (sessionId) {
    const session = getSession(sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    return NextResponse.json(session)
  }

  // Return all active sessions
  const sessions = getAllSessions()
  return NextResponse.json(sessions)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionId, language = 'en' } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    }

    // Check if session already exists
    const existing = getSession(sessionId)
    if (existing) {
      return NextResponse.json(existing)
    }

    const session = createSession(sessionId, language)
    return NextResponse.json(session, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionId, language, conversationState, message } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    }

    const session = getSession(sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Add message if provided
    if (message) {
      addMessageToSession(sessionId, message.role, message.content)
    }

    // Update session properties
    const updates: Record<string, unknown> = {}
    if (language) updates.language = language
    if (conversationState) updates.conversationState = { ...session.conversationState, ...conversationState }

    const updated = updateSession(sessionId, updates)
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  }

  deleteSession(sessionId)
  return NextResponse.json({ success: true })
}
