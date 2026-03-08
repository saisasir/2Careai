import { AppSidebar } from '@/components/app-sidebar'
import { AppHeader } from '@/components/app-header'
import { MetricsCards } from '@/components/metrics-cards'
import { VoiceInterface } from '@/components/voice-interface'
import { ActiveSessions } from '@/components/active-sessions'
import { RecentAppointments } from '@/components/recent-appointments'
import { LatencyChart } from '@/components/latency-chart'
import { CampaignStatus } from '@/components/campaign-status'
import { systemMetrics, voiceSessions, appointments, outboundCampaigns } from '@/lib/mock-data'

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="pl-64">
        <AppHeader 
          title="Voice Agent Dashboard" 
          subtitle="Real-time multilingual voice AI for clinical appointments"
        />
        <div className="p-6 space-y-6">
          <MetricsCards metrics={systemMetrics} />
          
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <VoiceInterface />
            </div>
            <div className="lg:col-span-2 space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <ActiveSessions sessions={voiceSessions} />
                <LatencyChart />
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <RecentAppointments appointments={appointments} />
                <CampaignStatus campaigns={outboundCampaigns} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
