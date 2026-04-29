import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, X, ClipboardList, FileText, Wrench, Calendar, User, MapPin, Edit2, Check } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import EventDetailPanel from '@/components/calendario/EventDetailPanel';

const PRIORITY_COLORS = {
  urgente: 'bg-red-500',
  alta: 'bg-orange-500',
  media: 'bg-blue-500',
  baja: 'bg-slate-400',
};

const TYPE_COLORS = {
  ot: 'bg-blue-500',
  informe: 'bg-violet-500',
  maintenance: 'bg-purple-400',
};

const LEGEND = [
  ['bg-blue-500', 'OT - Media'],
  ['bg-red-500', 'OT - Urgente'],
  ['bg-orange-500', 'OT - Alta'],
  ['bg-violet-500', 'Informe'],
  ['bg-purple-400', 'Mantenimiento'],
];

function buildEvents(orders, informes, assets) {
  const otEvents = orders
    .filter(o => o.scheduled_date)
    .map(o => ({
      id: o.id,
      title: o.title,
      date: o.scheduled_date,
      type: 'ot',
      status: o.status,
      priority: o.priority,
      assignee: o.assigned_name,
      location: o.location,
      color: PRIORITY_COLORS[o.priority] || 'bg-blue-500',
      raw: o,
    }));

  const informeEvents = informes
    .filter(i => i.fecha_limite)
    .map(i => ({
      id: i.id,
      title: i.titulo,
      date: i.fecha_limite,
      type: 'informe',
      status: i.estado,
      priority: i.prioridad,
      assignee: i.responsable,
      location: i.proyecto_nombre,
      color: 'bg-violet-500',
      raw: i,
    }));

  const maintEvents = assets
    .filter(a => a.next_maintenance)
    .map(a => ({
      id: a.id,
      title: `Mant: ${a.name}`,
      date: a.next_maintenance,
      type: 'maintenance',
      status: 'pendiente',
      priority: a.criticality === 'critica' ? 'urgente' : a.criticality,
      assignee: a.location,
      location: a.location,
      color: a.criticality === 'critica' ? 'bg-red-500' : a.criticality === 'alta' ? 'bg-orange-400' : 'bg-purple-400',
      raw: a,
    }));

  return [...otEvents, ...informeEvents, ...maintEvents];
}

export default function Calendario() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const queryClient = useQueryClient();

  const { data: orders = [] } = useQuery({ queryKey: ['workorders'], queryFn: () => base44.entities.WorkOrder.list() });
  const { data: informes = [] } = useQuery({ queryKey: ['informes'], queryFn: () => base44.entities.Informe.list() });
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list() });

  const updateOT = useMutation({
    mutationFn: ({ id, data }) => base44.entities.WorkOrder.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workorders'] }),
  });

  const updateInforme = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Informe.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['informes'] }),
  });

  const events = useMemo(() => buildEvents(orders, informes, assets), [orders, informes, assets]);

  const getEventsForDay = (date) => events.filter(e => isSameDay(parseISO(e.date), date));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = [];
  let day = calStart;
  while (day <= calEnd) { days.push(day); day = addDays(day, 1); }

  const todayEvents = getEventsForDay(new Date());
  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  const upcoming = useMemo(() =>
    events
      .filter(e => { const d = parseISO(e.date); return d >= new Date() && d <= addDays(new Date(), 7); })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8),
    [events]
  );

  const handleEventClick = (ev, e) => {
    e.stopPropagation();
    setSelectedEvent(ev);
    setSelectedDay(null);
  };

  const handleDayClick = (d) => {
    setSelectedEvent(null);
    setSelectedDay(isSameDay(d, selectedDay) ? null : d);
  };

  const handleSaveDate = async (event, newDate) => {
    if (event.type === 'ot') {
      await updateOT.mutateAsync({ id: event.id, data: { scheduled_date: newDate } });
    } else if (event.type === 'informe') {
      await updateInforme.mutateAsync({ id: event.id, data: { fecha_limite: newDate } });
    }
    // Refresh the event in panel
    setSelectedEvent(ev => ev ? { ...ev, date: newDate, raw: { ...ev.raw, scheduled_date: newDate, fecha_limite: newDate } } : ev);
  };

  const handleClosePanel = () => setSelectedEvent(null);

  return (
    <div className="min-h-screen space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          Calendario
        </h1>
        <p className="text-slate-400 mt-1">Órdenes de trabajo, informes y mantenimientos programados</p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-400">
        {LEGEND.map(([c, l]) => (
          <div key={l} className="flex items-center gap-1.5">
            <div className={`h-2.5 w-2.5 rounded-full ${c}`} />
            {l}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Calendar grid */}
        <Card className="lg:col-span-3 bg-slate-800/50 backdrop-blur border-slate-700/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-700/50" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-3">
                <h2 className="font-semibold text-base capitalize text-white">
                  {format(currentDate, 'MMMM yyyy', { locale: es })}
                </h2>
                <Button variant="outline" size="sm" className="h-7 text-xs border-slate-600 text-slate-300 hover:bg-slate-700" onClick={() => setCurrentDate(new Date())}>
                  Hoy
                </Button>
              </div>
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-700/50" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            {/* Day names */}
            <div className="grid grid-cols-7 mb-1">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                <div key={d} className="text-center text-xs font-semibold text-slate-500 py-2">{d}</div>
              ))}
            </div>
            {/* Days grid */}
            <div className="grid grid-cols-7 gap-px bg-slate-700/30 rounded-lg overflow-hidden">
              {days.map((d, i) => {
                const dayEvents = getEventsForDay(d);
                const isSelected = selectedDay && isSameDay(d, selectedDay);
                const isCurrentMonth = isSameMonth(d, currentDate);
                const isT = isToday(d);
                return (
                  <div
                    key={i}
                    onClick={() => handleDayClick(d)}
                    className={cn(
                      'bg-slate-800/60 min-h-[80px] p-1.5 cursor-pointer transition-colors select-none',
                      !isCurrentMonth && 'opacity-30',
                      isSelected && 'ring-1 ring-inset ring-primary/60 bg-primary/10',
                      isT && !isSelected && 'bg-primary/10',
                      'hover:bg-slate-700/60'
                    )}
                  >
                    <div className={cn(
                      'h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium mb-1 text-slate-300',
                      isT && 'bg-primary text-white font-bold'
                    )}>
                      {format(d, 'd')}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map((ev, idx) => (
                        <div
                          key={idx}
                          onClick={(e) => handleEventClick(ev, e)}
                          className={`text-[10px] font-medium text-white rounded px-1 py-0.5 truncate cursor-pointer hover:opacity-80 transition-opacity ${ev.color}`}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} más</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Event detail panel */}
          {selectedEvent && (
            <EventDetailPanel
              event={selectedEvent}
              onClose={handleClosePanel}
              onSaveDate={handleSaveDate}
              isSaving={updateOT.isPending || updateInforme.isPending}
            />
          )}

          {/* Today */}
          {!selectedEvent && (
            <Card className="bg-slate-800/50 backdrop-blur border-slate-700/50">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2 text-white">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  Hoy — {format(new Date(), 'd MMM', { locale: es })}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                {todayEvents.length === 0 ? (
                  <p className="text-xs text-slate-500">Sin eventos hoy</p>
                ) : (
                  <div className="space-y-1.5">
                    {todayEvents.map(ev => (
                      <MiniEventRow key={ev.id} event={ev} onClick={() => setSelectedEvent(ev)} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Selected day */}
          {!selectedEvent && selectedDay && (
            <Card className="bg-slate-800/50 backdrop-blur border-slate-700/50">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm capitalize text-white">
                  {format(selectedDay, 'EEEE d MMM', { locale: es })}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                {selectedDayEvents.length === 0 ? (
                  <p className="text-xs text-slate-500">Sin eventos</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedDayEvents.map(ev => (
                      <MiniEventRow key={ev.id} event={ev} onClick={() => setSelectedEvent(ev)} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Upcoming 7 days */}
          {!selectedEvent && (
            <Card className="bg-slate-800/50 backdrop-blur border-slate-700/50">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm text-white">Próximos 7 días</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                {upcoming.length === 0 ? (
                  <p className="text-xs text-slate-500">Sin eventos próximos</p>
                ) : (
                  <div className="space-y-1.5">
                    {upcoming.map(ev => (
                      <div key={ev.id} className="flex items-start gap-2 cursor-pointer hover:bg-slate-700/40 rounded p-1 transition-colors" onClick={() => setSelectedEvent(ev)}>
                        <div className={`h-2 w-2 rounded-full mt-1.5 flex-shrink-0 ${ev.color}`} />
                        <div className="min-w-0">
                          <div className="text-xs font-medium leading-tight truncate text-slate-300">{ev.title}</div>
                          <div className="text-[10px] text-slate-500">{format(parseISO(ev.date), 'd MMM', { locale: es })}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniEventRow({ event, onClick }) {
  const typeIcon = event.type === 'ot' ? ClipboardList : event.type === 'informe' ? FileText : Wrench;
  const Icon = typeIcon;
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-700/50 cursor-pointer transition-colors"
    >
      <div className={`h-6 w-6 rounded flex items-center justify-center flex-shrink-0 ${event.color}`}>
        <Icon className="h-3 w-3 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium truncate text-slate-300">{event.title}</div>
        {event.assignee && <div className="text-[10px] text-slate-500 truncate">{event.assignee}</div>}
      </div>
    </div>
  );
}