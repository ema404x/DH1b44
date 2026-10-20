import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { CheckCircle2, AlertTriangle, Clock, Edit2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const fmtDate = (d) => {
  try { return d ? format(parseISO(d), 'dd/MM/yyyy HH:mm', { locale: es }) : '-'; } catch { return '-'; }
};

export default function HistorialAutomatizaciones() {
  const AUTOMATIZACIONES_SISTEMA = [
    { nombre: 'checkAlertas', label: 'Chequeo diario de alertas', horario: 'Diario 8:00 AM' },
    { nombre: 'generateMonthlyCertificates', label: 'Generar Certificados Mensuales', horario: 'Diario 8:00 AM' },
    { nombre: 'detectarPatronesEmergencias', label: 'Detección de Patrones', horario: 'Diario 10:00 AM' },
    { nombre: 'resumenSemanal', label: 'Resumen Semanal por Email', horario: 'Lunes 8:00 AM' },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Automatizaciones Programadas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {AUTOMATIZACIONES_SISTEMA.map(auto => (
          <div key={auto.nombre} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-muted/20 transition-colors">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{auto.label}</p>
              <p className="text-[10px] text-muted-foreground">{auto.horario}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="outline" className="text-[9px] flex-shrink-0 border-emerald-500/30 text-emerald-400">
                activa
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}