import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar, Clock, User, MapPin } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const priorityColors = {
  urgente: 'bg-red-500',
  alta: 'bg-orange-500',
  media: 'bg-blue-500',
  baja: 'bg-slate-400',
};
const statusDot = {
  pendiente: 'bg-amber-400',
  asignada: 'bg-blue-400',
  en_progreso: 'bg-indigo-500',
  completada: 'bg-emerald-500',
  cancelada: 'bg-gray-400',
};

export default function Calendario() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); // month | week
  const [selectedDay, setSelectedDay] = useState(null);

  const { data: orders = [] } = useQuery({ queryKey: ['workorders'], queryFn: () => base44.entities.WorkOrder.list() });
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list() });

  // Combine work orders + asset maintenances as events
  const events = useMemo(() => {
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
        color: priorityColors[o.priority] || 'bg-blue-500',
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
        color: a.criticality === 'critica' ? 'bg-red-500' : a.criticality === 'alta' ? 'bg-orange-400' : 'bg-purple-500',
      }));

    return [...otEvents, ...maintEvents];
  }, [orders, assets]);

  const getEventsForDay = (date) => events.filter(e => isSameDay(parseISO(e.date), date));

  // Build calendar grid
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = [];
  let day = calStart;
  while (day <= calEnd) { days.push(day); day = addDays(day, 1); }

  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : [];
  const todayEvents = getEventsForDay(new Date());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Calendario</h1>
          <p className="text-muted-foreground mt-1">Órdenes de trabajo y mantenimientos programados</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-lg overflow-hidden">
            <Button variant={view === 'month' ? 'default' : 'ghost'} size="sm" className="rounded-none" onClick={() => setView('month')}>Mes</Button>
            <Button variant={view === 'week' ? 'default' : 'ghost'} size="sm" className="rounded-none" onClick={() => setView('week')}>Semana</Button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {[['bg-blue-500','OT - Media'],['bg-red-500','OT - Urgente'],['bg-orange-500','OT - Alta'],['bg-purple-500','Mantenimiento'],['bg-red-500','Mant. Crítico']].map(([c,l]) => (
          <div key={l} className="flex items-center gap-1.5"><div className={`h-2.5 w-2.5 rounded-full ${c}`} />{l}</div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <h2 className="font-semibold text-lg capitalize">{format(currentDate, 'MMMM yyyy', { locale: es })}</h2>
              <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            {/* Day names */}
            <div className="grid grid-cols-7 mb-1">
              {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => (
                <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
              ))}
            </div>
            {/* Days */}
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {days.map((d, i) => {
                const dayEvents = getEventsForDay(d);
                const isSelected = selectedDay && isSameDay(d, selectedDay);
                const isCurrentMonth = isSameMonth(d, currentDate);
                const isT = isToday(d);
                return (
                  <div
                    key={i}
                    onClick={() => setSelectedDay(isSameDay(d, selectedDay) ? null : d)}
                    className={cn(
                      'bg-card min-h-[72px] p-1.5 cursor-pointer transition-colors',
                      !isCurrentMonth && 'opacity-40',
                      isSelected && 'bg-primary/8 ring-1 ring-inset ring-primary/30',
                      isT && !isSelected && 'bg-primary/5',
                      'hover:bg-accent'
                    )}
                  >
                    <div className={cn(
                      'h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium mb-1',
                      isT && 'bg-primary text-primary-foreground font-bold'
                    )}>
                      {format(d, 'd')}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map((ev, idx) => (
                        <div key={idx} className={`text-[10px] font-medium text-white rounded px-1 py-0.5 truncate ${ev.color}`}>
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
          {/* Today */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                Hoy — {format(new Date(), 'd MMM', { locale: es })}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              {todayEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin eventos hoy</p>
              ) : (
                <div className="space-y-2">
                  {todayEvents.map(ev => (
                    <EventCard key={ev.id} event={ev} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected day */}
          {selectedDay && (
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm capitalize">
                  {format(selectedDay, 'EEEE d MMM', { locale: es })}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                {selectedEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin eventos</p>
                ) : (
                  <div className="space-y-2">
                    {selectedEvents.map(ev => (
                      <EventCard key={ev.id} event={ev} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Upcoming */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm">Próximos 7 días</CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              {(() => {
                const upcoming = events
                  .filter(e => {
                    const d = parseISO(e.date);
                    return d >= new Date() && d <= addDays(new Date(), 7);
                  })
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .slice(0, 8);
                return upcoming.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin eventos próximos</p>
                ) : (
                  <div className="space-y-2">
                    {upcoming.map(ev => (
                      <div key={ev.id} className="flex items-start gap-2">
                        <div className={`h-2 w-2 rounded-full mt-1.5 flex-shrink-0 ${ev.color}`} />
                        <div>
                          <div className="text-xs font-medium leading-tight">{ev.title}</div>
                          <div className="text-[10px] text-muted-foreground">{format(parseISO(ev.date), 'd MMM', { locale: es })}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function EventCard({ event }) {
  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
      <div className={`h-2 w-2 rounded-full mt-1.5 flex-shrink-0 ${event.color}`} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium leading-tight truncate">{event.title}</div>
        {event.assignee && <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{event.assignee}</div>}
        <Badge variant="outline" className="text-[10px] mt-1 h-4 px-1">{event.type === 'ot' ? 'OT' : 'Mantenimiento'}</Badge>
      </div>
    </div>
  );
}