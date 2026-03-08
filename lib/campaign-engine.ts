// Outbound Campaign Engine
// Supports: appointment reminders, follow-ups, vaccination reminders

export type CampaignType = 'appointment_reminder' | 'follow_up' | 'vaccination' | 'confirmation' | 'custom'
export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled'

export interface Campaign {
  id: string
  name: string
  type: CampaignType
  status: CampaignStatus
  language: 'en' | 'hi' | 'ta' | 'all'
  targetPatients: string[] // patient IDs
  totalCalls: number
  completedCalls: number
  successfulCalls: number
  failedCalls: number
  scheduledTime?: string
  startedAt?: Date
  completedAt?: Date
  message: {
    en: string
    hi: string
    ta: string
  }
  createdAt: Date
  updatedAt: Date
}

export interface CampaignCall {
  id: string
  campaignId: string
  patientId: string
  patientName: string
  patientPhone: string
  language: 'en' | 'hi' | 'ta'
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'no_answer'
  outcome?: 'confirmed' | 'rescheduled' | 'cancelled' | 'callback_requested' | 'no_response'
  duration?: number
  callStartedAt?: Date
  callEndedAt?: Date
  transcript?: string
}

// In-memory stores
const campaigns: Map<string, Campaign> = new Map()
const campaignCalls: Map<string, CampaignCall> = new Map()

// Default campaign messages
const defaultMessages: Record<CampaignType, { en: string, hi: string, ta: string }> = {
  appointment_reminder: {
    en: "Hello, this is a reminder about your upcoming appointment. Please press 1 to confirm, 2 to reschedule, or 3 to cancel.",
    hi: "नमस्ते, यह आपकी आगामी अपॉइंटमेंट की याद दिलाने के लिए है। कृपया पुष्टि के लिए 1 दबाएं, पुनर्निर्धारित करने के लिए 2, या रद्द करने के लिए 3।",
    ta: "வணக்கம், இது உங்கள் வரவிருக்கும் சந்திப்பு பற்றிய நினைவூட்டல். உறுதிப்படுத்த 1, மறுதிட்டமிட 2, அல்லது ரத்து செய்ய 3 அழுத்தவும்."
  },
  follow_up: {
    en: "Hello, we are calling to follow up on your recent visit. How are you feeling today?",
    hi: "नमस्ते, हम आपकी हाल की मुलाकात के बारे में फॉलो-अप कर रहे हैं। आज आप कैसा महसूस कर रहे हैं?",
    ta: "வணக்கம், உங்கள் சமீபத்திய வருகை பற்றி தொடர்புகொள்ள அழைக்கிறோம். இன்று எப்படி உணர்கிறீர்கள்?"
  },
  vaccination: {
    en: "Hello, this is a reminder that you are due for your vaccination. Would you like to schedule an appointment?",
    hi: "नमस्ते, यह याद दिलाने के लिए है कि आपका टीकाकरण बाकी है। क्या आप अपॉइंटमेंट लेना चाहेंगे?",
    ta: "வணக்கம், உங்கள் தடுப்பூசி நேரம் வந்துவிட்டது என்பதை நினைவூட்ட அழைக்கிறோம். சந்திப்பு முன்பதிவு செய்ய விரும்புகிறீர்களா?"
  },
  confirmation: {
    en: "Hello, we are calling to confirm your appointment scheduled for tomorrow. Please press 1 to confirm or 2 to speak with our staff.",
    hi: "नमस्ते, हम कल के लिए निर्धारित आपकी अपॉइंटमेंट की पुष्टि के लिए कॉल कर रहे हैं। पुष्टि के लिए 1 या हमारे स्टाफ से बात करने के लिए 2 दबाएं।",
    ta: "வணக்கம், நாளைக்கு திட்டமிடப்பட்ட உங்கள் சந்திப்பை உறுதிப்படுத்த அழைக்கிறோம். உறுதிப்படுத்த 1 அல்லது எங்கள் ஊழியர்களுடன் பேச 2 அழுத்தவும்."
  },
  custom: {
    en: "",
    hi: "",
    ta: ""
  }
}

// Initialize sample campaigns
const sampleCampaigns: Omit<Campaign, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'camp-1',
    name: 'Tomorrow Appointment Reminders',
    type: 'appointment_reminder',
    status: 'active',
    language: 'all',
    targetPatients: ['patient-1', 'patient-2', 'patient-3'],
    totalCalls: 45,
    completedCalls: 32,
    successfulCalls: 28,
    failedCalls: 4,
    startedAt: new Date(Date.now() - 3600000),
    message: defaultMessages.appointment_reminder
  },
  {
    id: 'camp-2',
    name: 'Post-Surgery Follow-up',
    type: 'follow_up',
    status: 'scheduled',
    language: 'en',
    targetPatients: ['patient-4', 'patient-5'],
    totalCalls: 12,
    completedCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    scheduledTime: new Date(Date.now() + 86400000).toISOString(),
    message: defaultMessages.follow_up
  },
  {
    id: 'camp-3',
    name: 'Flu Vaccination Drive',
    type: 'vaccination',
    status: 'completed',
    language: 'all',
    targetPatients: ['patient-1', 'patient-2', 'patient-3', 'patient-4'],
    totalCalls: 156,
    completedCalls: 156,
    successfulCalls: 142,
    failedCalls: 14,
    startedAt: new Date(Date.now() - 172800000),
    completedAt: new Date(Date.now() - 86400000),
    message: defaultMessages.vaccination
  }
]

// Initialize campaigns
sampleCampaigns.forEach(camp => {
  campaigns.set(camp.id, {
    ...camp,
    createdAt: new Date(Date.now() - Math.random() * 604800000),
    updatedAt: new Date()
  })
})

// Campaign Functions
export function getAllCampaigns(): Campaign[] {
  return Array.from(campaigns.values())
}

export function getCampaignById(id: string): Campaign | undefined {
  return campaigns.get(id)
}

export function getCampaignsByStatus(status: CampaignStatus): Campaign[] {
  return Array.from(campaigns.values()).filter(c => c.status === status)
}

export function createCampaign(data: {
  name: string
  type: CampaignType
  language: 'en' | 'hi' | 'ta' | 'all'
  targetPatients: string[]
  scheduledTime?: string
  message?: { en: string, hi: string, ta: string }
}): Campaign {
  const campaign: Campaign = {
    id: `camp-${Date.now()}`,
    name: data.name,
    type: data.type,
    status: data.scheduledTime ? 'scheduled' : 'draft',
    language: data.language,
    targetPatients: data.targetPatients,
    totalCalls: data.targetPatients.length,
    completedCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    scheduledTime: data.scheduledTime,
    message: data.message || defaultMessages[data.type],
    createdAt: new Date(),
    updatedAt: new Date()
  }
  
  campaigns.set(campaign.id, campaign)
  return campaign
}

export function updateCampaign(id: string, updates: Partial<Campaign>): Campaign | undefined {
  const campaign = campaigns.get(id)
  if (!campaign) return undefined
  
  const updated = {
    ...campaign,
    ...updates,
    updatedAt: new Date()
  }
  campaigns.set(id, updated)
  return updated
}

export function startCampaign(id: string): Campaign | undefined {
  return updateCampaign(id, {
    status: 'active',
    startedAt: new Date()
  })
}

export function pauseCampaign(id: string): Campaign | undefined {
  return updateCampaign(id, { status: 'paused' })
}

export function resumeCampaign(id: string): Campaign | undefined {
  return updateCampaign(id, { status: 'active' })
}

export function cancelCampaign(id: string): Campaign | undefined {
  return updateCampaign(id, { status: 'cancelled' })
}

export function completeCampaign(id: string): Campaign | undefined {
  return updateCampaign(id, {
    status: 'completed',
    completedAt: new Date()
  })
}

// Campaign Call Functions
export function getCampaignCalls(campaignId: string): CampaignCall[] {
  return Array.from(campaignCalls.values()).filter(c => c.campaignId === campaignId)
}

export function recordCampaignCall(data: {
  campaignId: string
  patientId: string
  patientName: string
  patientPhone: string
  language: 'en' | 'hi' | 'ta'
  status: CampaignCall['status']
  outcome?: CampaignCall['outcome']
  duration?: number
  transcript?: string
}): CampaignCall {
  const call: CampaignCall = {
    id: `call-${Date.now()}`,
    ...data,
    callStartedAt: new Date()
  }
  
  if (data.status === 'completed' || data.status === 'failed' || data.status === 'no_answer') {
    call.callEndedAt = new Date()
    
    // Update campaign stats
    const campaign = campaigns.get(data.campaignId)
    if (campaign) {
      campaign.completedCalls++
      if (data.status === 'completed' && data.outcome && data.outcome !== 'no_response') {
        campaign.successfulCalls++
      } else {
        campaign.failedCalls++
      }
      campaign.updatedAt = new Date()
      campaigns.set(campaign.id, campaign)
    }
  }
  
  campaignCalls.set(call.id, call)
  return call
}

// Stats
export function getCampaignStats() {
  const allCampaigns = getAllCampaigns()
  const active = allCampaigns.filter(c => c.status === 'active').length
  const scheduled = allCampaigns.filter(c => c.status === 'scheduled').length
  const completed = allCampaigns.filter(c => c.status === 'completed').length
  
  const totalCalls = allCampaigns.reduce((sum, c) => sum + c.totalCalls, 0)
  const completedCalls = allCampaigns.reduce((sum, c) => sum + c.completedCalls, 0)
  const successfulCalls = allCampaigns.reduce((sum, c) => sum + c.successfulCalls, 0)
  
  return {
    totalCampaigns: allCampaigns.length,
    activeCampaigns: active,
    scheduledCampaigns: scheduled,
    completedCampaigns: completed,
    totalCalls,
    completedCalls,
    successfulCalls,
    successRate: completedCalls > 0 ? Math.round((successfulCalls / completedCalls) * 100) : 0
  }
}

export { defaultMessages }
