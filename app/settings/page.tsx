'use client'

import { useState } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { AppHeader } from '@/components/app-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Globe, Mic, Phone, Bell, Shield, Database, Zap, CheckCircle } from 'lucide-react'

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    clinicName: 'HealthCare Clinic',
    clinicPhone: '+91 98765 43210',
    clinicEmail: 'contact@healthcare.com',
    defaultLanguage: 'en',
    enableHindi: true,
    enableTamil: true,
    voiceSpeed: 'normal',
    enableReminders: true,
    reminderHours: '24',
    enableFollowups: true,
    enableConfirmations: true,
    maxLatency: '450',
    autoRetry: true,
    enableLogging: true
  })

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="pl-64">
        <AppHeader title="Settings" subtitle="Configure your voice AI system" />
        <div className="p-6">
          <Tabs defaultValue="general" className="space-y-6">
            <TabsList className="bg-card border border-border">
              <TabsTrigger value="general" className="data-[state=active]:bg-secondary">
                General
              </TabsTrigger>
              <TabsTrigger value="voice" className="data-[state=active]:bg-secondary">
                Voice & Language
              </TabsTrigger>
              <TabsTrigger value="campaigns" className="data-[state=active]:bg-secondary">
                Campaigns
              </TabsTrigger>
              <TabsTrigger value="performance" className="data-[state=active]:bg-secondary">
                Performance
              </TabsTrigger>
            </TabsList>

            {/* General Settings */}
            <TabsContent value="general" className="space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                      <Database className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Clinic Information</CardTitle>
                      <CardDescription>Basic details about your clinic</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="clinicName">Clinic Name</Label>
                      <Input
                        id="clinicName"
                        value={settings.clinicName}
                        onChange={(e) => setSettings(prev => ({ ...prev, clinicName: e.target.value }))}
                        className="bg-secondary border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clinicPhone">Phone Number</Label>
                      <Input
                        id="clinicPhone"
                        value={settings.clinicPhone}
                        onChange={(e) => setSettings(prev => ({ ...prev, clinicPhone: e.target.value }))}
                        className="bg-secondary border-border"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clinicEmail">Email Address</Label>
                    <Input
                      id="clinicEmail"
                      type="email"
                      value={settings.clinicEmail}
                      onChange={(e) => setSettings(prev => ({ ...prev, clinicEmail: e.target.value }))}
                      className="bg-secondary border-border"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Integration Status</CardTitle>
                      <CardDescription>Connected services and APIs</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Speech-to-Text API</p>
                          <p className="text-xs text-muted-foreground">Connected and operational</p>
                        </div>
                      </div>
                      <Badge className="bg-primary/20 text-primary border-primary/30">Active</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Text-to-Speech API</p>
                          <p className="text-xs text-muted-foreground">Connected and operational</p>
                        </div>
                      </div>
                      <Badge className="bg-primary/20 text-primary border-primary/30">Active</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm font-medium text-foreground">AI Language Model</p>
                          <p className="text-xs text-muted-foreground">GPT-4 connected</p>
                        </div>
                      </div>
                      <Badge className="bg-primary/20 text-primary border-primary/30">Active</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Voice & Language Settings */}
            <TabsContent value="voice" className="space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                      <Globe className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Language Configuration</CardTitle>
                      <CardDescription>Configure supported languages for voice interactions</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Default Language</Label>
                    <Select 
                      value={settings.defaultLanguage} 
                      onValueChange={(val) => setSettings(prev => ({ ...prev, defaultLanguage: val }))}
                    >
                      <SelectTrigger className="w-64 bg-secondary border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="hi">Hindi</SelectItem>
                        <SelectItem value="ta">Tamil</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator />
                  <div className="space-y-4">
                    <Label>Additional Languages</Label>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Hindi (हिंदी)</p>
                        <p className="text-xs text-muted-foreground">Enable Hindi language support</p>
                      </div>
                      <Switch
                        checked={settings.enableHindi}
                        onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enableHindi: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Tamil (தமிழ்)</p>
                        <p className="text-xs text-muted-foreground">Enable Tamil language support</p>
                      </div>
                      <Switch
                        checked={settings.enableTamil}
                        onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enableTamil: checked }))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                      <Mic className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Voice Settings</CardTitle>
                      <CardDescription>Configure voice output preferences</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Voice Speed</Label>
                    <Select 
                      value={settings.voiceSpeed} 
                      onValueChange={(val) => setSettings(prev => ({ ...prev, voiceSpeed: val }))}
                    >
                      <SelectTrigger className="w-64 bg-secondary border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="slow">Slow</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="fast">Fast</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Campaign Settings */}
            <TabsContent value="campaigns" className="space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                      <Bell className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Notification Settings</CardTitle>
                      <CardDescription>Configure automated outbound call settings</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Appointment Reminders</p>
                      <p className="text-xs text-muted-foreground">Automatically call patients to remind them</p>
                    </div>
                    <Switch
                      checked={settings.enableReminders}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enableReminders: checked }))}
                    />
                  </div>
                  {settings.enableReminders && (
                    <div className="ml-4 pl-4 border-l-2 border-border space-y-2">
                      <Label>Reminder Time (hours before appointment)</Label>
                      <Select 
                        value={settings.reminderHours} 
                        onValueChange={(val) => setSettings(prev => ({ ...prev, reminderHours: val }))}
                      >
                        <SelectTrigger className="w-40 bg-secondary border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="12">12 hours</SelectItem>
                          <SelectItem value="24">24 hours</SelectItem>
                          <SelectItem value="48">48 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Follow-up Calls</p>
                      <p className="text-xs text-muted-foreground">Call patients after missed appointments</p>
                    </div>
                    <Switch
                      checked={settings.enableFollowups}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enableFollowups: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Confirmation Calls</p>
                      <p className="text-xs text-muted-foreground">Confirm appointments after booking</p>
                    </div>
                    <Switch
                      checked={settings.enableConfirmations}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enableConfirmations: checked }))}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Performance Settings */}
            <TabsContent value="performance" className="space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                      <Zap className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Latency Configuration</CardTitle>
                      <CardDescription>Configure response time targets and optimization</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Maximum Latency Target (ms)</Label>
                    <Input
                      type="number"
                      value={settings.maxLatency}
                      onChange={(e) => setSettings(prev => ({ ...prev, maxLatency: e.target.value }))}
                      className="w-40 bg-secondary border-border"
                    />
                    <p className="text-xs text-muted-foreground">Target response time from speech end to audio start</p>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Auto Retry on Failure</p>
                      <p className="text-xs text-muted-foreground">Automatically retry failed API calls</p>
                    </div>
                    <Switch
                      checked={settings.autoRetry}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, autoRetry: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Enable Detailed Logging</p>
                      <p className="text-xs text-muted-foreground">Log all pipeline stages for debugging</p>
                    </div>
                    <Switch
                      checked={settings.enableLogging}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enableLogging: checked }))}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" className="border-border">
              Reset to Defaults
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              Save Changes
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
