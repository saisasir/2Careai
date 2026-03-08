'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Phone, Play, Pause, Clock } from 'lucide-react'
import type { OutboundCampaign } from '@/lib/types'
import { cn } from '@/lib/utils'

interface CampaignStatusProps {
  campaigns: OutboundCampaign[]
}

const statusStyles = {
  active: 'bg-primary/20 text-primary border-primary/30',
  paused: 'bg-warning/20 text-warning border-warning/30',
  completed: 'bg-muted text-muted-foreground border-border'
}

const typeLabels = {
  reminder: 'Reminder',
  'follow-up': 'Follow-up',
  confirmation: 'Confirmation'
}

export function CampaignStatus({ campaigns }: CampaignStatusProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Outbound Campaigns</CardTitle>
          <Button variant="outline" size="sm" className="text-xs border-border">
            <Phone className="h-3 w-3 mr-1" />
            New Campaign
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {campaigns.map((campaign) => {
          const progress = (campaign.completedCount / campaign.targetCount) * 100

          return (
            <div key={campaign.id} className="p-3 rounded-lg bg-secondary/50 border border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{campaign.name}</p>
                  <Badge variant="outline" className="text-xs border-border">
                    {typeLabels[campaign.type]}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn('text-xs capitalize', statusStyles[campaign.status])}>
                    {campaign.status}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    {campaign.status === 'active' ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{campaign.completedCount} / {campaign.targetCount} completed</span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{campaign.scheduledTime}</span>
                  </div>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
