import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Filter, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, parseISO, isToday, isPast } from 'date-fns';
import { es } from 'date-fns/locale';

const ESTADO_COLORS = {
  pendiente: { bg: 'bg-amber-50', border: 'border-amber-300', badge: 'bg-amber-200 text-amber-900', icon: Clock },
  en_preparacion: { bg: 'bg-blue-50', border: 'border-blue-300', badge: 'bg-blue-200 text-blue-900', icon: Clock },
  enviado: { bg: 'bg-emerald-50', border: 'border-emerald-300', badge: 'bg-emerald-200 text-emerald-900', icon: CheckCircle2 },
  aprobado: { bg: 'bg-green-50', border: 'border-green-300', badge: 'bg-green-200 text-green-900', icon: CheckCircle2 },
};

const ESTADOS = ['pendiente', 'en_preparacion', 'enviado', 'aprobado'];

export default function CalendarioInformes() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 4, 1)); // Mayo 2026
  const [selectedEstados, setSelectedEstados] = useState(ESTADOS);

  const { data: informes = [], isLoading } = useQuery({
    queryKey: ['informes'],
    queryFn: () => base44.entities.Informe.list(),
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Agrupar informes por fecha límite
  const informesByDate = useMemo(() => {
    const map = {};
    informes
      .filter(inf => selectedEstados.includes(inf.estado))
      .forEach(inf => {
        if (inf.fecha_limite) {
          const dateStr = inf.fecha_limite;
          if (!map[dateStr]) map[dateStr] = [];
          map[dateStr].push(inf);
        }
      });
    return map;
  }, [informes, selectedEstados]);

  // Estadísticas del mes
  const stats = useMemo(() => {
    const monthInformes = informes.filter(inf => 
      selectedEstados.includes(inf.estado) && 
      inf.fecha_limite && 
      isSameMonth(parseISO(inf.fecha_limite), currentDate)
    );
    const vencidos = monthInformes.filter(inf => isPast(parseISO(inf.fecha_limite)) && !isToday(parseISO(inf.fecha_limite)));
    return { total: monthInformes.length, vencidos: vencidos.length };
  }, [informes, selectedEstados, currentDate]);

  const toggleEstado = (estado) => {
    setSelectedEstados(prev =>
      prev.includes(estado)
        ? prev.filter(e => e !== estado)
        : [...prev, estado]
    );
  };

  const previousMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

  if (isLoading) {
    return <div className="p-6">Cargando...</div>;
  }

  const monthYear = format(currentDate, 'MMMM yyyy', { locale: es });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">📅 Calendario de Informes</h1>
        <p className="text-muted-foreground">Gestiona y visualiza todos los vencimientos de informes</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Informes este mes</p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vencidos</p>
                <p className="text-3xl font-bold text-red-600">{stats.vencidos}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completados</p>
                <p className="text-3xl font-bold text-emerald-600">
                  {informes.filter(i => i.estado === 'enviado' || i.estado === 'aprobado').length}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-emerald-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <CardTitle className="text-sm">Filtrar por estado</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {ESTADOS.map(estado => (
            <Badge
              key={estado}
              variant={selectedEstados.includes(estado) ? 'default' : 'outline'}
              className="cursor-pointer px-3 py-1.5"
              onClick={() => toggleEstado(estado)}
            >
              {estado.charAt(0).toUpperCase() + estado.slice(1).replace('_', ' ')}
            </Badge>
          ))}
        </CardContent>
      </Card>

      {/* Calendario */}
      <Card>
        <CardHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={previousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-xl font-semibold capitalize">{monthYear}</h2>
            <Button variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Días de la semana */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
              <div key={day} className="text-center font-semibold text-xs text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Días del mes */}
          <div className="grid grid-cols-7 gap-2">
            {/* Días vacíos antes del mes */}
            {Array.from({ length: monthStart.getDay() }).map((_, i) => (
              <div key={`empty-start-${i}`} className="aspect-square" />
            ))}

            {/* Días del mes */}
            {daysInMonth.map((day, idx) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayInformes = informesByDate[dateStr] || [];
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isDayToday = isToday(day);
              const isVencido = isPast(day) && !isDayToday && dayInformes.length > 0;

              return (
                <div
                  key={idx}
                  className={`aspect-square p-2 border-2 rounded-lg transition-all ${
                    isDayToday
                      ? 'bg-primary/10 border-primary shadow-md'
                      : isVencido
                      ? 'bg-red-50 border-red-300'
                      : isCurrentMonth
                      ? 'bg-background border-border hover:border-primary hover:shadow-sm'
                      : 'bg-muted/30 border-transparent'
                  }`}
                >
                  <div className={`text-xs font-bold mb-1 flex items-center justify-between`}>
                    <span className={isDayToday ? 'text-primary font-black' : isVencido ? 'text-red-600' : 'text-muted-foreground'}>
                      {format(day, 'd')}
                    </span>
                    {dayInformes.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">
                        {dayInformes.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5 min-h-0 text-[9px]">
                    {dayInformes.slice(0, 2).map((inf, i) => (
                      <div
                        key={i}
                        className={`px-1 py-0.5 rounded truncate font-medium ${ESTADO_COLORS[inf.estado]?.badge || 'bg-gray-200 text-gray-700'}`}
                        title={inf.titulo}
                      >
                        {inf.titulo.substring(0, 10)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Próximos vencimientos y vencidos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Vencidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {informes
                .filter(inf => selectedEstados.includes(inf.estado) && inf.fecha_limite && isPast(parseISO(inf.fecha_limite)) && !isToday(parseISO(inf.fecha_limite)))
                .sort((a, b) => new Date(b.fecha_limite) - new Date(a.fecha_limite))
                .map(inf => (
                  <div key={inf.id} className="flex items-center justify-between p-2.5 border border-red-200 rounded-lg bg-red-50/50">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-900">{inf.titulo}</p>
                      <p className="text-xs text-red-700">
                        Venció: {format(parseISO(inf.fecha_limite), 'd MMM', { locale: es })}
                      </p>
                    </div>
                    <AlertCircle className="h-4 w-4 text-red-600 ml-2" />
                  </div>
                ))}
              {informes.filter(inf => selectedEstados.includes(inf.estado) && inf.fecha_limite && isPast(parseISO(inf.fecha_limite)) && !isToday(parseISO(inf.fecha_limite))).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">✓ Sin informes vencidos</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Próximos 10 días
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {informes
                .filter(inf => selectedEstados.includes(inf.estado) && inf.fecha_limite)
                .sort((a, b) => new Date(a.fecha_limite) - new Date(b.fecha_limite))
                .slice(0, 10)
                .map(inf => {
                  const daysLeft = Math.ceil((new Date(inf.fecha_limite) - new Date()) / (1000 * 60 * 60 * 24));
                  const isUrgent = daysLeft <= 3;
                  return (
                    <div key={inf.id} className={`flex items-center justify-between p-2.5 border rounded-lg ${isUrgent ? 'bg-red-50 border-red-200' : 'bg-background border-border'}`}>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${isUrgent ? 'text-red-900' : ''}`}>{inf.titulo}</p>
                        <p className={`text-xs ${isUrgent ? 'text-red-700' : 'text-muted-foreground'}`}>
                          {daysLeft > 0 ? `En ${daysLeft} día${daysLeft > 1 ? 's' : ''}` : 'Hoy'} • {format(parseISO(inf.fecha_limite), 'd MMM', { locale: es })}
                        </p>
                      </div>
                      <Badge variant={isUrgent ? 'default' : 'secondary'} className="ml-2">
                        {daysLeft}d
                      </Badge>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}