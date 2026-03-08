'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { AppSidebar } from '@/components/app-sidebar'
import { AppHeader } from '@/components/app-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Play, Pause, Phone, Clock, Users, CheckCircle, RotateCw, Loader2, RefreshCw, Calendar, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface Campaign {
  id: string
  name: string
  type: 'appointment_reminder' | 'follow_up' | 'vaccination' | 'confirmation' | 'custom'
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled'
  language: 'en' | 'hi' | 'ta' | 'all'
  targetPatients: string[]
  totalCalls: number
  completedCalls: number
  successfulCalls: number
  failedCalls: number
  scheduledTime?: string
  startedAt?: string
  completedAt?: string
  message: { en: string, hi: string, ta: string }
  createdAt: string
  updatedAt: string
}

interface CampaignStats {
  totalCampaigns: number
  activeCampaigns: number
  scheduledCampaigns: number
  completedCampaigns: number
  totalCalls: number
  completedCalls: number
  successfulCalls: number
  successRate: number
}

const statusStyles: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground border-border',
  scheduled: 'bg-chart-2/20 text-chart-2 border-chart-2/30',
  active: 'bg-primary/20 text-primary border-primary/30',
  paused: 'bg-chart-3/20 text-chart-3 border-chart-3/30',
  completed: 'bg-chart-1/20 text-chart-1 border-chart-1/30',
  cancelled: 'bg-destructive/20 text-destructive border-destructive/30'
}

const typeLabels: Record<string, string> = {
  appointment_reminder: 'Appointment Reminder',
  follow_up: 'Follow-up',
  vaccination: 'Vaccination',
  confirmation: 'Confirmation',
  custom: 'Custom'
}

const typeIcons: Record<string, typeof Clock> = {
  appointment_reminder: Clock,
  follow_up: RotateCw,
  vaccination: CheckCircle,
  confirmation: Phone,
  custom: Phone
}

export default function CampaignsPage() {
  const { data: campaigns = [], isLoading } = useSWR<Campaign[]>('/api/campaigns', fetcher)
  const { data: stats } = useSWR<CampaignStats>('/api/campaigns?type=stats', fetcher, { refreshInterval: 5000 })
  
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    type: 'appointment_reminder' as Campaign['type'],
    language: 'all' as Campaign['language'],
    targetCount: 10,
    scheduledTime: '',
    messageEn: '',
    messageHi: '',
    messageTa: ''
  })

  const handleAction = async (id: string, action: 'start' | 'pause' | 'resume' | 'cancel') => {
    await fetch('/api/campaigns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action })
    })
    await mutate('/api/campaigns')
    await mutate('/api/campaigns?type=stats')
  }

  const handleCreateCampaign = async () => {
    if (!newCampaign.name || !newCampaign.targetCount) return

    setIsSubmitting(true)
    try {
      // Generate fake patient IDs for demo
      const targetPatients = Array.from(
        { length: newCampaign.targetCount }, 
        (_, i) => `patient-${Date.now()}-${i}`
      )

      await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCampaign.name,
          type: newCampaign.type,
          language: newCampaign.language,
          targetPatients,
          scheduledTime: newCampaign.scheduledTime || undefined,
          message: newCampaign.messageEn ? {
            en: newCampaign.messageEn,
            hi: newCampaign.messageHi || newCampaign.messageEn,
            ta: newCampaign.messageTa || newCampaign.messageEn
          } : undefined
        })
      })
      
      await mutate('/api/campaigns')
      await mutate('/api/campaigns?type=stats')
      setIsNewDialogOpen(false)
      setNewCampaign({
        name: '',
        type: 'appointment_reminder',
        language: 'all',
        targetCount: 10,
        scheduledTime: '',
        messageEn: '',
        messageHi: '',
        messageTa: ''
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="pl-64">
        <AppHeader title="Outbound Campaigns" subtitle="Manage automated call campaigns for reminders and follow-ups" />
        <div className="p-6 space-y-6">
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-foreground">{stats?.totalCampaigns || 0}</div>
                    <p className="text-sm text-muted-foreground">Total Campaigns</p>
                  </div>
                  <Phone className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-primary">{stats?.activeCampaigns || 0}</div>
                    <p className="text-sm text-muted-foreground">Active Campaigns</p>
                  </div>
                  <Play className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-foreground">{stats?.completedCalls || 0}</div>
                    <p className="text-sm text-muted-foreground">Completed Calls</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-primary">{stats?.successRate || 0}%</div>
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                  </div>
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                mutate('/api/campaigns')
                mutate('/api/campaigns?type=stats')
              }}
              className="border-border"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-2" />
                  New Campaign
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create New Campaign</DialogTitle>
                  <DialogDescription>
                    Set up a new outbound calling campaign for patient outreach.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Campaign Name</label>
                    <Input
                      placeholder="e.g., Tomorrow Appointment Reminders"
                      value={newCampaign.name}
                      onChange={(e) => setNewCampaign(prev => ({ ...prev, name: e.target.value }))}
                      className="bg-secondary border-border"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Campaign Type</label>
                      <Select 
                        value={newCampaign.type} 
                        onValueChange={(val) => setNewCampaign(prev => ({ ...prev, type: val as Campaign['type'] }))}
                      >
                        <SelectTrigger className="bg-secondary border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="appointment_reminder">Appointment Reminder</SelectItem>
                          <SelectItem value="follow_up">Follow-up Call</SelectItem>
                          <SelectItem value="vaccination">Vaccination Reminder</SelectItem>
                          <SelectItem value="confirmation">Confirmation Call</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Language</label>
                      <Select 
                        value={newCampaign.language} 
                        onValueChange={(val) => setNewCampaign(prev => ({ ...prev, language: val as Campaign['language'] }))}
                      >
                        <SelectTrigger className="bg-secondary border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Languages</SelectItem>
                          <SelectItem value="en">English Only</SelectItem>
                          <SelectItem value="hi">Hindi Only</SelectItem>
                          <SelectItem value="ta">Tamil Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Target Patients</label>
                      <Input
                        type="number"
                        placeholder="10"
                        value={newCampaign.targetCount || ''}
                        onChange={(e) => setNewCampaign(prev => ({ ...prev, targetCount: parseInt(e.target.value) || 0 }))}
                        className="bg-secondary border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Schedule (Optional)</label>
                      <Input
                        type="datetime-local"
                        value={newCampaign.scheduledTime}
                        onChange={(e) => setNewCampaign(prev => ({ ...prev, scheduledTime: e.target.value }))}
                        className="bg-secondary border-border"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Custom Message (English)</label>
                    <Textarea
                      placeholder="Leave empty to use default message for campaign type..."
                      value={newCampaign.messageEn}
                      onChange={(e) => setNewCampaign(prev => ({ ...prev, messageEn: e.target.value }))}
                      className="bg-secondary border-border min-h-[80px]"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsNewDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateCampaign} 
                    className="bg-primary text-primary-foreground"
                    disabled={isSubmitting || !newCampaign.name}
                  >
                    {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Campaign
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Campaigns Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((campaign) => {
                const progress = campaign.totalCalls > 0 
                  ? (campaign.completedCalls / campaign.totalCalls) * 100 
                  : 0
                const TypeIcon = typeIcons[campaign.type] || Phone

                return (
                  <Card key={campaign.id} className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                            <TypeIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <CardTitle className="text-sm font-semibold truncate max-w-[180px]">
                            {campaign.name}
                          </CardTitle>
                        </div>
                        <Badge variant="outline" className={cn('text-xs capitalize', statusStyles[campaign.status])}>
                          {campaign.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Type</span>
                        <span className="text-foreground">{typeLabels[campaign.type]}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Language</span>
                        <span className="text-foreground capitalize">{campaign.language === 'all' ? 'All' : campaign.language.toUpperCase()}</span>
                      </div>
                      {campaign.scheduledTime && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Scheduled</span>
                          <span className="text-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(campaign.scheduledTime)}
                          </span>
                        </div>
                      )}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="text-foreground">
                            {campaign.completedCalls} / {campaign.totalCalls}
                            {campaign.successfulCalls > 0 && (
                              <span className="text-primary ml-1">
                                ({campaign.successfulCalls} successful)
                              </span>
                            )}
                          </span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                      <div className="flex gap-2 pt-2">
                        {campaign.status === 'draft' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 border-border"
                            onClick={() => handleAction(campaign.id, 'start')}
                          >
                            <Play className="h-3.5 w-3.5 mr-1" />
                            Start
                          </Button>
                        )}
                        {campaign.status === 'scheduled' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 border-border"
                            onClick={() => handleAction(campaign.id, 'start')}
                          >
                            <Play className="h-3.5 w-3.5 mr-1" />
                            Start Now
                          </Button>
                        )}
                        {campaign.status === 'active' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 border-border"
                            onClick={() => handleAction(campaign.id, 'pause')}
                          >
                            <Pause className="h-3.5 w-3.5 mr-1" />
                            Pause
                          </Button>
                        )}
                        {campaign.status === 'paused' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 border-border"
                            onClick={() => handleAction(campaign.id, 'resume')}
                          >
                            <Play className="h-3.5 w-3.5 mr-1" />
                            Resume
                          </Button>
                        )}
                        {(campaign.status === 'active' || campaign.status === 'paused') && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleAction(campaign.id, 'cancel')}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Cancel
                          </Button>
                        )}
                        {campaign.status === 'completed' && (
                          <Button variant="ghost" size="sm" className="flex-1">
                            View Report
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              {campaigns.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  No campaigns yet. Create your first campaign to get started.
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
