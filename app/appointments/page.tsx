'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { AppSidebar } from '@/components/app-sidebar'
import { AppHeader } from '@/components/app-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Calendar, Clock, Search, Plus, User, X, Check, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

const fetcher = (url: string) => fetch(url).then(res => res.json())

const languageLabels: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  ta: 'Tamil'
}

const statusStyles: Record<string, string> = {
  scheduled: 'bg-chart-2/20 text-chart-2 border-chart-2/30',
  confirmed: 'bg-chart-1/20 text-chart-1 border-chart-1/30',
  completed: 'bg-primary/20 text-primary border-primary/30',
  cancelled: 'bg-destructive/20 text-destructive border-destructive/30',
  'no-show': 'bg-chart-3/20 text-chart-3 border-chart-3/30'
}

interface Appointment {
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
}

interface Doctor {
  id: string
  name: string
  specialty: string
  languages: string[]
}

export default function AppointmentsPage() {
  const { data: appointments = [], isLoading, error } = useSWR<Appointment[]>('/api/appointments', fetcher)
  const { data: doctors = [] } = useSWR<Doctor[]>('/api/doctors', fetcher)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedDoctor, setSelectedDoctor] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  
  const [newAppointment, setNewAppointment] = useState({
    patientName: '',
    patientPhone: '',
    doctorId: '',
    date: '',
    time: '',
    language: 'en' as 'en' | 'hi' | 'ta'
  })

  const filteredAppointments = appointments.filter(apt => {
    const matchesSearch = 
      apt.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.doctorName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || apt.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const checkAvailability = async (doctorId: string, date: string) => {
    if (!doctorId || !date) return
    
    setIsLoadingSlots(true)
    try {
      const res = await fetch('/api/doctors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId, date })
      })
      const data = await res.json()
      setAvailableSlots(data.slots || [])
    } catch (err) {
      console.error('Failed to check availability:', err)
      setAvailableSlots([])
    } finally {
      setIsLoadingSlots(false)
    }
  }

  const handleDoctorChange = (doctorId: string) => {
    setSelectedDoctor(doctorId)
    setNewAppointment(prev => ({ ...prev, doctorId, time: '' }))
    if (selectedDate) {
      checkAvailability(doctorId, selectedDate)
    }
  }

  const handleDateChange = (date: string) => {
    setSelectedDate(date)
    setNewAppointment(prev => ({ ...prev, date, time: '' }))
    if (selectedDoctor) {
      checkAvailability(selectedDoctor, date)
    }
  }

  const handleCreateAppointment = async () => {
    if (!newAppointment.patientName || !newAppointment.patientPhone || 
        !newAppointment.doctorId || !newAppointment.date || !newAppointment.time) return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: `patient-${Date.now()}`,
          patientName: newAppointment.patientName,
          patientPhone: newAppointment.patientPhone,
          doctorId: newAppointment.doctorId,
          date: newAppointment.date,
          time: newAppointment.time,
          language: newAppointment.language
        })
      })
      
      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Failed to book appointment')
        return
      }
      
      await mutate('/api/appointments')
      setIsNewDialogOpen(false)
      setNewAppointment({ patientName: '', patientPhone: '', doctorId: '', date: '', time: '', language: 'en' })
      setSelectedDoctor('')
      setSelectedDate('')
      setAvailableSlots([])
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAction = async (id: string, action: 'cancel' | 'complete' | 'confirm') => {
    await fetch('/api/appointments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action })
    })
    await mutate('/api/appointments')
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  // Get today's date for min attribute
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="pl-64">
        <AppHeader title="Appointments" subtitle="Manage patient appointments" />
        <div className="p-6 space-y-6">
          {/* Filters and Actions */}
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 items-center gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by patient or doctor..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 bg-secondary border-border"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40 bg-secondary border-border">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="no-show">No Show</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => mutate('/api/appointments')}
                    className="border-border"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                      <Plus className="h-4 w-4 mr-2" />
                      New Appointment
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-card border-border">
                    <DialogHeader>
                      <DialogTitle>Schedule New Appointment</DialogTitle>
                      <DialogDescription>
                        Book a new appointment for a patient with conflict detection.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Patient Name</label>
                          <Input
                            placeholder="Enter patient name"
                            value={newAppointment.patientName}
                            onChange={(e) => setNewAppointment(prev => ({ ...prev, patientName: e.target.value }))}
                            className="bg-secondary border-border"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Phone Number</label>
                          <Input
                            placeholder="+91 98765 43210"
                            value={newAppointment.patientPhone}
                            onChange={(e) => setNewAppointment(prev => ({ ...prev, patientPhone: e.target.value }))}
                            className="bg-secondary border-border"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Doctor</label>
                        <Select value={selectedDoctor} onValueChange={handleDoctorChange}>
                          <SelectTrigger className="bg-secondary border-border">
                            <SelectValue placeholder="Select doctor" />
                          </SelectTrigger>
                          <SelectContent>
                            {doctors.map(doctor => (
                              <SelectItem key={doctor.id} value={doctor.id}>
                                {doctor.name} - {doctor.specialty}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Date</label>
                          <Input
                            type="date"
                            min={today}
                            value={selectedDate}
                            onChange={(e) => handleDateChange(e.target.value)}
                            className="bg-secondary border-border"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Time Slot</label>
                          <Select 
                            value={newAppointment.time} 
                            onValueChange={(val) => setNewAppointment(prev => ({ ...prev, time: val }))}
                            disabled={!selectedDoctor || !selectedDate || isLoadingSlots}
                          >
                            <SelectTrigger className="bg-secondary border-border">
                              {isLoadingSlots ? (
                                <div className="flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span>Loading...</span>
                                </div>
                              ) : (
                                <SelectValue placeholder={availableSlots.length ? "Select time" : "Select doctor & date first"} />
                              )}
                            </SelectTrigger>
                            <SelectContent>
                              {availableSlots.length === 0 ? (
                                <div className="p-2 text-sm text-muted-foreground">No slots available</div>
                              ) : (
                                availableSlots.map(slot => (
                                  <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Language Preference</label>
                        <Select value={newAppointment.language} onValueChange={(val) => setNewAppointment(prev => ({ ...prev, language: val as 'en' | 'hi' | 'ta' }))}>
                          <SelectTrigger className="bg-secondary border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="hi">Hindi</SelectItem>
                            <SelectItem value="ta">Tamil</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsNewDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleCreateAppointment} 
                        className="bg-primary text-primary-foreground" 
                        disabled={isSubmitting || !newAppointment.patientName || !newAppointment.time}
                      >
                        {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Schedule Appointment
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Appointments Table */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                All Appointments ({filteredAppointments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : error ? (
                <div className="flex items-center justify-center py-12 text-destructive">
                  Failed to load appointments
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Patient</TableHead>
                      <TableHead className="text-muted-foreground">Doctor</TableHead>
                      <TableHead className="text-muted-foreground">Date & Time</TableHead>
                      <TableHead className="text-muted-foreground">Language</TableHead>
                      <TableHead className="text-muted-foreground">Status</TableHead>
                      <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAppointments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                          No appointments found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAppointments.map((appointment) => (
                        <TableRow key={appointment.id} className="border-border">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                                <User className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <span className="font-medium text-foreground">{appointment.patientName}</span>
                                <p className="text-xs text-muted-foreground">{appointment.patientPhone}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-foreground">{appointment.doctorName}</p>
                              <p className="text-xs text-muted-foreground">{appointment.specialty}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-foreground">{formatDate(appointment.date)}</span>
                              <Clock className="h-3.5 w-3.5 text-muted-foreground ml-2" />
                              <span className="text-foreground">{appointment.time}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-border">
                              {languageLabels[appointment.language]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('capitalize', statusStyles[appointment.status])}>
                              {appointment.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {(appointment.status === 'scheduled' || appointment.status === 'confirmed') && (
                              <div className="flex items-center justify-end gap-1">
                                {appointment.status === 'scheduled' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-chart-1 hover:text-chart-1"
                                    onClick={() => handleAction(appointment.id, 'confirm')}
                                  >
                                    Confirm
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-primary hover:text-primary"
                                  onClick={() => handleAction(appointment.id, 'complete')}
                                  title="Mark as completed"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => handleAction(appointment.id, 'cancel')}
                                  title="Cancel appointment"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
