import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentsService } from '@/services/appointmentsService';
import { clientsService } from '@/services/clientsService';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Appointment, AppointmentStatus, Client } from '@/types/database';
import { AppointmentWithRelations } from '@/types/app';
import { Plus, Edit, Trash2, Calendar as CalendarIcon, Clock, Loader2, List, CalendarDays, Phone, Mail, User, Building2, X, Search } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { transliterateFullName } from '@/lib/transliterate';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { AppointmentDialog } from '@/components/appointments/AppointmentDialog';
import { formatDate, formatTime } from '@/lib/format';
import { useSearchParams } from 'react-router-dom';



const formatTime12h = (dateString: string) =>
  formatTime(dateString, { hour: 'numeric', minute: '2-digit', hour12: true });

const formatDateLong = (dateString: string) =>
  formatDate(dateString, { dateStyle: 'long' });

const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: 'مجدول',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  no_show: 'لم يحضر',
};

const statusColors: Record<AppointmentStatus, string> = {
  scheduled: 'bg-info text-info-foreground',
  completed: 'bg-success text-success-foreground',
  cancelled: 'bg-destructive text-destructive-foreground',
  no_show: 'bg-warning text-warning-foreground',
};

const leadStatusLabels: Record<string, string> = {
  new: 'جديد',
  contacting: 'قيد التواصل',
  appointment_booked: 'موعد محجوز',
  interviewed: 'تمت المقابلة',
  no_show: 'غائب',
  sold: 'تم البيع',
  cancelled: 'ملغاة',
};

interface LeadInfo {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  source: string | null;
  notes: string | null;
  created_at: string;
}

export default function Appointments() {
  const { client, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentWithRelations | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState<LeadInfo | null>(null);
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
      if (e.key === 'n' && activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
        e.preventDefault();
        setEditingAppointment(null);
        setDialogOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const clearFilters = () => {
    setSearch('');
    setStartDate('');
    setEndDate('');
    setSelectedDate(new Date());
    setSelectedClientFilter('all');
    setSelectedClientFilter('all');
  };

  const handleQuickDatePreset = (preset: string) => {
    const today = new Date();
    switch (preset) {
      case 'today':
        setStartDate(format(today, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case 'week': {
        const startWeek = startOfWeek(today, { weekStartsOn: 6 });
        const endWeek = endOfWeek(today, { weekStartsOn: 6 });
        setStartDate(format(startWeek, 'yyyy-MM-dd'));
        setEndDate(format(endWeek, 'yyyy-MM-dd'));
        break;
      }
      case 'month': {
        const startMonth = startOfMonth(today);
        const endMonth = endOfMonth(today);
        setStartDate(format(startMonth, 'yyyy-MM-dd'));
        setEndDate(format(endMonth, 'yyyy-MM-dd'));
        break;
      }
      case 'all':
        setStartDate('');
        setEndDate('');
        break;
    }
  };

  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery({
    queryKey: ['appointments', isAdmin],
    queryFn: () => appointmentsService.getAppointments(isAdmin) as Promise<AppointmentWithRelations[]>,
    staleTime: 1000 * 60 * 1,
    refetchOnMount: true,
  });

  useEffect(() => {
    const leadId = searchParams.get('leadId');
    if (!leadId || appointments.length === 0) return;
    const match = appointments.find((apt: any) => apt.lead_id === leadId || apt.lead?.id === leadId);
    if (match?.lead) {
      setSelectedLead({
        id: match.lead.id,
        first_name: match.lead.first_name ?? null,
        last_name: match.lead.last_name ?? null,
        phone: match.lead.phone ?? null,
        email: match.lead.email ?? null,
        status: match.lead.status ?? 'new',
        source: match.lead.source ?? null,
        notes: match.lead.notes ?? null,
        created_at: match.lead.created_at ?? match.created_at,
      });
    }
  }, [appointments, searchParams]);

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsService.getClients(),
    enabled: isAdmin,
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });

  const handleEdit = (appointment: AppointmentWithRelations) => {
    setEditingAppointment(appointment);
    setDialogOpen(true);
  };

  const handleLeadClick = (lead: any) => {
    if (!lead) return;
    setSelectedLead({
      id: lead.id,
      first_name: lead.first_name,
      last_name: lead.last_name,
      phone: lead.phone,
      email: lead.email,
      status: lead.status,
      source: lead.source,
      notes: lead.notes,
      created_at: lead.created_at,
    });
    setLeadDialogOpen(true);
  };

  const deleteMutation = useMutation({
    mutationFn: appointmentsService.deleteAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({ title: 'تم الحذف', description: 'تم حذف الموعد بنجاح' });
    },
    onError: () => {
      toast({ title: 'خطأ', description: 'فشل في حذف الموعد', variant: 'destructive' });
    }
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const filteredAppointments = appointments
    .filter(apt => {
      const matchesClient = selectedClientFilter === 'all' || apt.client_id === selectedClientFilter;

      let matchesDate = true;
      if (viewMode === 'calendar' && selectedDate) {
        matchesDate = format(new Date(apt.scheduled_at), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
      } else {
        if (startDate) {
          matchesDate = matchesDate && new Date(apt.scheduled_at) >= new Date(startDate);
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && new Date(apt.scheduled_at) <= end;
        }
      }

      const searchTerm = search.toLowerCase().trim();
      const matchesSearch = !searchTerm ||
        `${apt.lead?.first_name || ''} ${apt.lead?.last_name || ''}`.toLowerCase().includes(searchTerm) ||
        (apt.lead?.phone || '').includes(searchTerm);

      return matchesClient && matchesDate && matchesSearch;
    })
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

  const getAppointmentsForDate = (date: Date) => {
    return appointments.filter(apt =>
      format(new Date(apt.scheduled_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">المواعيد</h1>
            <p className="text-muted-foreground">جدولة وإدارة المواعيد</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border rounded-lg">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('calendar')}
                className="rounded-r-none"
              >
                <CalendarDays className="h-4 w-4" />
              </Button>
            </div>
            <Button className="gap-2" onClick={() => { setEditingAppointment(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4" />
              إضافة موعد
            </Button>
            <AppointmentDialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              appointment={editingAppointment}
              isAdmin={isAdmin}
              onSuccess={() => queryClient.invalidateQueries({ queryKey: ['appointments'] })}
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 w-full">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث عن موعد (بالاسم أو الرقم)..."
                  className="pr-10 h-10 w-full"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="flex flex-col xl:flex-row items-center gap-3 w-full xl:w-auto mt-4 xl:mt-0">
                <div className="flex items-center gap-2 w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0">
                  {/* Quick Presets */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-[130px] justify-between h-10">
                        الفترة
                        <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleQuickDatePreset('today')}>
                        اليوم
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleQuickDatePreset('week')}>
                        هذا الأسبوع
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleQuickDatePreset('month')}>
                        هذا الشهر
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleQuickDatePreset('all')}>
                        كل الوقت
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Start Date Popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={`h-10 w-[140px] justify-start text-start font-normal ${!startDate && "text-muted-foreground"}`}>
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {startDate ? format(new Date(startDate), 'yyyy/MM/dd') : 'من'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate ? new Date(startDate) : undefined}
                        onSelect={(date) => setStartDate(date ? format(date, 'yyyy-MM-dd') : '')}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <span className="text-muted-foreground">→</span>

                  {/* End Date Popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={`h-10 w-[140px] justify-start text-start font-normal ${!endDate && "text-muted-foreground"}`}>
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {endDate ? format(new Date(endDate), 'yyyy/MM/dd') : 'إلى'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate ? new Date(endDate) : undefined}
                        onSelect={(date) => setEndDate(date ? format(date, 'yyyy-MM-dd') : '')}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex items-center gap-2 w-full xl:w-auto">
                  {isAdmin && (
                    <Select value={selectedClientFilter} onValueChange={setSelectedClientFilter}>
                      <SelectTrigger className="w-full xl:w-[200px] h-10">
                        <SelectValue placeholder="كل العملاء" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">كل العملاء</SelectItem>
                        {clients.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {(startDate || endDate || selectedClientFilter !== 'all' || search) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={clearFilters}
                      className="h-10 w-10 text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0 sm:p-6 overflow-hidden">
            {viewMode === 'calendar' ? (
              <div className="grid md:grid-cols-2 gap-6 p-4 sm:p-0">
                <Card>
                  <CardHeader>
                    <CardTitle>التقويم</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      className="rounded-md border"
                      modifiers={{
                        hasAppointment: (date) => getAppointmentsForDate(date).length > 0,
                      }}
                      modifiersStyles={{
                        hasAppointment: { backgroundColor: 'hsl(var(--primary) / 0.1)', fontWeight: 'bold' },
                      }}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>
                      مواعيد {selectedDate ? formatDate(selectedDate, { dateStyle: 'full' }) : 'اليوم'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {filteredAppointments.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">لا توجد مواعيد</p>
                    ) : (
                      <div className="space-y-3">
                        {filteredAppointments.map((apt: any) => (
                          <div key={apt.id} className="p-4 border rounded-lg">
                            <div className="flex justify-between items-start">
                              <div>
                                <button
                                  onClick={() => handleLeadClick(apt.lead)}
                                  className="font-medium text-primary hover:underline cursor-pointer text-right"
                                >
                                  {transliterateFullName(apt.lead?.first_name, apt.lead?.last_name)}
                                </button>
                                {isAdmin && apt.client?.company_name && (
                                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Building2 className="h-3 w-3" />
                                    {apt.client.company_name}
                                  </p>
                                )}
                                {apt.lead?.phone && (
                                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {apt.lead.phone}
                                  </p>
                                )}
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatTime12h(apt.scheduled_at)}
                                </p>
                                {apt.location && <p className="text-sm text-muted-foreground">{apt.location}</p>}
                              </div>
                              <Badge className={statusColors[apt.status as AppointmentStatus]}>
                                {statusLabels[apt.status as AppointmentStatus]}
                              </Badge>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(apt)}>تعديل</Button>
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(apt.id)}>حذف</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="pt-0">
                {appointmentsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : filteredAppointments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">لا توجد مواعيد</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">العميل المحتمل</TableHead>
                        {isAdmin && <TableHead className="text-right">العميل (الشركة)</TableHead>}
                        <TableHead className="text-right">رقم الهاتف</TableHead>
                        <TableHead className="text-right">التاريخ</TableHead>
                        <TableHead className="text-right">الموقع</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAppointments.map((appointment: any) => (
                        <TableRow key={appointment.id}>
                          <TableCell className="font-medium">
                            <button
                              onClick={() => handleLeadClick(appointment.lead)}
                              className="text-primary hover:underline cursor-pointer"
                            >
                              {transliterateFullName(appointment.lead?.first_name, appointment.lead?.last_name)}
                            </button>
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                {appointment.client?.company_name || '-'}
                              </div>
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Phone className="h-4 w-4" />
                              {appointment.lead?.phone || '-'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <CalendarIcon className="h-4 w-4" />
                              {formatDateLong(appointment.scheduled_at)} - {formatTime12h(appointment.scheduled_at)}
                            </div>
                          </TableCell>
                          <TableCell>{appointment.location || '-'}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[appointment.status as AppointmentStatus]}>
                              {statusLabels[appointment.status as AppointmentStatus]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(appointment)}><Edit className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(appointment.id)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lead Info Dialog */}
        <Dialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                معلومات العميل المحتمل
              </DialogTitle>
            </DialogHeader>
            {selectedLead && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">الاسم</p>
                      <p className="font-medium">{transliterateFullName(selectedLead.first_name, selectedLead.last_name)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">رقم الهاتف</p>
                      <p className="font-medium" dir="ltr">{selectedLead.phone || '-'}</p>
                    </div>
                  </div>

                  {selectedLead.email && (
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">البريد الإلكتروني</p>
                        <p className="font-medium" dir="ltr">{selectedLead.email}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">تاريخ الإضافة</p>
                      <p className="font-medium">{formatDateLong(selectedLead.created_at)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">الحالة</p>
                      </div>
                    </div>
                    <Badge>{leadStatusLabels[selectedLead.status] || selectedLead.status}</Badge>
                  </div>

                  {selectedLead.source && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">المصدر</p>
                      <p className="font-medium">{selectedLead.source}</p>
                    </div>
                  )}

                  {selectedLead.notes && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">ملاحظات</p>
                      <p className="text-sm">{selectedLead.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
