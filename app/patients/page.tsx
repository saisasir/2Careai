'use client'

import { useState } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { AppHeader } from '@/components/app-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Search, Plus, Mail, Phone, Globe, Calendar } from 'lucide-react'
import { patients, appointments, languageLabels } from '@/lib/mock-data'

export default function PatientsPage() {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.phone.includes(searchQuery)
  )

  const getPatientAppointmentCount = (patientId: string) => {
    return appointments.filter(apt => apt.patientId === patientId).length
  }

  const getLastAppointment = (patientId: string) => {
    const patientApts = appointments
      .filter(apt => apt.patientId === patientId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return patientApts[0]
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="pl-64">
        <AppHeader title="Patients" subtitle="Manage patient records" />
        <div className="p-6 space-y-6">
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-foreground">{patients.length}</div>
                <p className="text-sm text-muted-foreground">Total Patients</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-foreground">
                  {patients.filter(p => p.language === 'en').length}
                </div>
                <p className="text-sm text-muted-foreground">English Speakers</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-foreground">
                  {patients.filter(p => p.language === 'hi').length}
                </div>
                <p className="text-sm text-muted-foreground">Hindi Speakers</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-foreground">
                  {patients.filter(p => p.language === 'ta').length}
                </div>
                <p className="text-sm text-muted-foreground">Tamil Speakers</p>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search patients by name, email, or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-secondary border-border"
                  />
                </div>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Patient
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Patients Table */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                All Patients ({filteredPatients.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Patient</TableHead>
                    <TableHead className="text-muted-foreground">Contact</TableHead>
                    <TableHead className="text-muted-foreground">Language</TableHead>
                    <TableHead className="text-muted-foreground">Appointments</TableHead>
                    <TableHead className="text-muted-foreground">Last Visit</TableHead>
                    <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients.map((patient) => {
                    const lastApt = getLastAppointment(patient.id)
                    return (
                      <TableRow key={patient.id} className="border-border">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="bg-secondary text-foreground text-sm">
                                {getInitials(patient.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-foreground">{patient.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Since {patient.createdAt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm text-foreground">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                              {patient.phone}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Mail className="h-3.5 w-3.5" />
                              {patient.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-border">
                            <Globe className="h-3 w-3 mr-1" />
                            {languageLabels[patient.language]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-foreground">{getPatientAppointmentCount(patient.id)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {lastApt ? (
                            <div className="text-sm">
                              <p className="text-foreground">
                                {new Date(lastApt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </p>
                              <p className="text-xs text-muted-foreground">{lastApt.doctorName}</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">No visits</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-xs">
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
