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
  const [controls, setControls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarControles();
  }, []);

  const cargarControles = async () => {
    try {
      const data = await base44.entities.AutomationControl.list();
      setControls(data);
    } catch (e) {
      console.error('Error cargando controles:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleAutomatizacion = async (control) => {
    try {
      await base44.entities.AutomationControl.update(control.id, { activa: !control.activa });
      setControls(controls.map(c => c.id === control.id ? { ...c, activa: !c.activa } : c));
    } catch (e) {
      console.error('Error actualizando:', e);
    }
  };

  const AUTOMATIZACIONES_SISTEMA = [
    { nombre: 'checkAlertas', label: 'Chequeo diario de alertas', horario: 'Diario 8:00 AM' },
    { nombre: 'generateMonthlyCertificates', label: 'Generar Certificados Mensuales', horario: 'Diario 8:00 AM' },
    { nombre: 'detectarPatronesEmergencias', label: 'Detección de Patrones', horario: 'Diario 10:00 AM' },
    { nombre: 'resumenSemanal', label: 'Resumen Semanal por Email', horario: 'Lunes 8:00 AM' },
  ];

  if (loading) {
    return <div className="text-xs text-muted-foreground">Cargando...</div>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Automatizaciones Programadas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {AUTOMATIZACIONES_SISTEMA.map(auto => {
          const control = controls.find(c => c.nombre === auto.nombre);
          const activa = control?.activa ?? true;
          const estadoUltima = control?.estado_ultima_ejecucion || 'pendiente';
          const ultimaEjecucion = control?.ultima_ejecucion;

          const statusIcon = 
            estadoUltima === 'exitosa' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> :
            estadoUltima === 'fallida' ? <AlertTriangle className="h-3.5 w-3.5 text-red-400" /> :
            <Clock className="h-3.5 w-3.5 text-slate-400" />;

          return (
            <div key={auto.nombre} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-muted/20 transition-colors">
              {statusIcon}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{auto.label}</p>
                <p className="text-[10px] text-muted-foreground">
                  {auto.horario}
                  {ultimaEjecucion && ` · Última: ${fmtDate(ultimaEjecucion)}`}
                </p>
                {control?.total_ejecuciones > 0 && (
                  <p className="text-[9px] text-muted-foreground">
                    {control.total_ejecuciones} ejecuciones
                    {control.total_errores > 0 && ` · ${control.total_errores} error${control.total_errores > 1 ? 'es' : ''}`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="outline" className={`text-[9px] flex-shrink-0 ${activa ? 'border-emerald-500/30 text-emerald-400' : 'border-slate-500/30 text-slate-400'}`}>
                  {activa ? 'activa' : 'inactiva'}
                </Badge>
                <Switch
                  checked={activa}
                  onCheckedChange={() => toggleAutomatizacion(control || { nombre: auto.nombre, activa: true, id: `temp-${auto.nombre}` })}
                  className="h-4"
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}