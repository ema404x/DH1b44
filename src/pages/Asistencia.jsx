import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, LogIn, LogOut, MapPin, Clock, Users, Calendar } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { format, startOfDay, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Asistencia() {
  const [search, setSearch] = useState('');
  const [dayFilter, setDayFilter] = useState('today');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['attendance'],
    queryFn: () => base44.entities.AttendanceLog.list('-timestamp', 500),
  });

  const getDateFrom = () => {
    if (dayFilter === 'today') return startOfDay(new Date());
    if (dayFilter === '7days') return subDays(new Date(), 7);
    if (dayFilter === '30days') return subDays(new Date(), 30);
    return null;
  };

  const filtered = logs.filter(log => {
    const matchSearch = !search || log.employee_name?.toLowerCase().includes(search.toLowerCase());
    const dateFrom = getDateFrom();
    const matchDate = !dateFrom || new Date(log.timestamp) >= dateFrom;
    return matchSearch && matchDate;
  });

  const todayLogs = logs.filter(l => new Date(l.timestamp) >= startOfDay(new Date()));
  const todayEntradas = todayLogs.filter(l => l.type === 'entrada').length;
  const uniqueToday = new Set(todayLogs.map(l => l.employee_id)).size;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registro de Asistencia"
        subtitle="Historial de fichajes por QR con ubicación GPS"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Entradas Hoy', value: todayEntradas, icon: LogIn, color: 'border-l-emerald-500' },
          { label: 'Empleados Hoy', value: uniqueToday, icon: Users, color: 'border-l-blue-500' },
          { label: 'Total Registros', value: logs.length, icon: Clock, color: 'border-l-slate-400' },
          { label: 'Con Ubicación', value: logs.filter(l => l.latitude).length, icon: MapPin, color: 'border-l-purple-500' },
        ].map(s => (
          <Card key={s.label} className={`border-l-4 ${s.color}`}>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <s.icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar empleado..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={dayFilter} onValueChange={setDayFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoy</SelectItem>
            <SelectItem value="7days">Últimos 7 días</SelectItem>
            <SelectItem value="30days">Últimos 30 días</SelectItem>
            <SelectItem value="all">Todo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Log list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Registros ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 && !isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Sin registros para el período seleccionado</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filtered.map(log => (
                <div key={log.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${log.type === 'entrada' ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                    {log.type === 'entrada'
                      ? <LogIn className="h-4 w-4 text-emerald-600" />
                      : <LogOut className="h-4 w-4 text-blue-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{log.employee_name}</span>
                      <Badge variant="outline" className={`text-[10px] ${log.type === 'entrada' ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : 'border-blue-300 text-blue-700 bg-blue-50'}`}>
                        {log.type}
                      </Badge>
                    </div>
                    {log.location_name && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{log.location_name}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-semibold">
                      {format(new Date(log.timestamp), 'HH:mm')}hs
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(log.timestamp), "d MMM yy", { locale: es })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}