import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const ESTADO_COLORS = {
  pendiente: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-800' },
  en_preparacion: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-800' },
  enviado: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-800' },
};

const ESTADOS = ['pendiente', 'en_preparacion', 'enviado'];

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
      <div>
        <h1 className="text-3xl font-bold">Calendario de Informes</h1>
        <p className="text-sm text-muted-foreground mt-1">Visualiza los vencimientos de informes por mes</p>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Filtrar por estado</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {ESTADOS.map(estado => (
            <Badge
              key={estado}
              variant={selectedEstados.includes(estado) ? 'default' : 'outline'}
              className="cursor-pointer"
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

              return (
                <div
                  key={idx}
                  className={`aspect-square p-1 border rounded-lg transition-all ${
                    isCurrentMonth
                      ? 'bg-background border-border hover:border-primary hover:shadow-sm'
                      : 'bg-muted/30 border-transparent'
                  }`}
                >
                  <div className="text-xs font-semibold text-muted-foreground mb-0.5">
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-0.5 min-h-0">
                    {dayInformes.slice(0, 2).map((inf, i) => (
                      <div
                        key={i}
                        className={`text-[10px] px-1.5 py-0.5 rounded truncate ${ESTADO_COLORS[inf.estado]?.badge || 'bg-gray-100'}`}
                        title={inf.titulo}
                      >
                        {inf.titulo.split('(')[0].substring(0, 12)}
                      </div>
                    ))}
                    {dayInformes.length > 2 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{dayInformes.length - 2} más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Resumen de informes vencidos/próximos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Próximos vencimientos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {informes
              .filter(inf => selectedEstados.includes(inf.estado) && inf.fecha_limite)
              .sort((a, b) => new Date(a.fecha_limite) - new Date(b.fecha_limite))
              .slice(0, 10)
              .map(inf => (
                <div key={inf.id} className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{inf.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      Vence: {format(parseISO(inf.fecha_limite), 'd MMM yyyy', { locale: es })}
                    </p>
                  </div>
                  <Badge className={ESTADO_COLORS[inf.estado]?.badge || ''}>
                    {inf.estado}
                  </Badge>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}