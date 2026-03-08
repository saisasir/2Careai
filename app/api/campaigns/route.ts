import { NextRequest, NextResponse } from 'next/server'
import {
  getAllCampaigns,
  getCampaignById,
  getCampaignsByStatus,
  createCampaign,
  updateCampaign,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  completeCampaign,
  getCampaignStats,
  getCampaignCalls,
  recordCampaignCall
} from '@/lib/campaign-engine'
import { backendAuthPost } from '@/lib/backend-client'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const status = searchParams.get('status')
  const type = searchParams.get('type')

  if (type === 'stats') {
    return NextResponse.json(getCampaignStats())
  }

  if (id) {
    const campaign = getCampaignById(id)
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    
    // Include calls if requested
    if (searchParams.get('includeCalls') === 'true') {
      const calls = getCampaignCalls(id)
      return NextResponse.json({ campaign, calls })
    }
    
    return NextResponse.json(campaign)
  }

  let campaigns = getAllCampaigns()
  
  if (status) {
    campaigns = getCampaignsByStatus(status as any)
  }

  // Sort by createdAt desc
  campaigns.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return NextResponse.json(campaigns)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, type, language, targetPatients, scheduledTime, message } = body

    if (!name || !type || !targetPatients || targetPatients.length === 0) {
      return NextResponse.json(
        { error: 'name, type, and targetPatients are required' },
        { status: 400 }
      )
    }

    const campaign = createCampaign({
      name,
      type,
      language: language || 'all',
      targetPatients,
      scheduledTime,
      message
    })

    return NextResponse.json(campaign, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, action, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Campaign id required' }, { status: 400 })
    }

    let result

    switch (action) {
      case 'start': {
        result = startCampaign(id)
        // Also trigger real backend outbound call if campaign has a target phone
        const campaign = getCampaignById(id)
        if (campaign && campaign.targetPatients?.length > 0) {
          try {
            await backendAuthPost('/campaign/trigger', {
              phone: campaign.targetPatients[0],
              campaign_type: campaign.type || 'reminder',
            })
          } catch {
            // Log but don't fail — Twilio may not be configured
            console.warn('Backend campaign trigger unavailable (Twilio may not be configured)')
          }
        }
        break
      }
      case 'pause':
        result = pauseCampaign(id)
        break
      case 'resume':
        result = resumeCampaign(id)
        break
      case 'cancel':
        result = cancelCampaign(id)
        break
      case 'complete':
        result = completeCampaign(id)
        break
      case 'recordCall':
        const { patientId, patientName, patientPhone, language, status, outcome, duration, transcript } = updates
        const call = recordCampaignCall({
          campaignId: id,
          patientId,
          patientName,
          patientPhone,
          language,
          status,
          outcome,
          duration,
          transcript
        })
        return NextResponse.json(call)
      default:
        result = updateCampaign(id, updates)
    }

    if (!result) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
