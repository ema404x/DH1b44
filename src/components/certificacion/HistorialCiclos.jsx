import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronDown, ChevronUp, FileCheck, DollarSign, CheckCircle2 } from 'lucide-react';
import ObraCertificacionCard from '@/components/certificacion/ObraCertificacionCard';

const ESTADO_CONFIG = {
  listo_certificar:   { label: 'Listo para Certificar',    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  faltan_actas:       { label: 'Faltan Cargar Actas',      color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  pendiente:          { label: 'Pendiente',                color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  observado:          { label: 'Observado',                color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
  falta_aprobar_mein: { label: 'Falta Aprobar Orden MEIN', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
};
const PRIORIDAD_CONFIG = {
  normal:  { label: 'Normal',  color: 'bg-slate-500/15 text-slate-400' },
  alta:    { label: 'Alta',    color: 'bg-orange-500/15 text-orange-400' },
  urgente: { label: 'Urgente', color: 'bg-red-500/15 text-red-400' },
};

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

function CicloHistoricoCard({ ciclo }) {
  const [expanded, setExpanded] = useState(false);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-ciclo', ciclo.id],
    queryFn: () => base44.entities.ObraCertificacion.filter({ ciclo_id: ciclo.id }, '-created_date', 500),
    enabled: expanded,
  });

  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{ciclo.periodo}</h3>
              <p className="text-xs text-muted-foreground">
                {ciclo.fecha_inicio && `Desde ${ciclo.fecha_inicio}`}
                {ciclo.fecha_cierre && ` · Cerrado ${ciclo.fecha_cierre}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                <FileCheck className="h-3.5 w-3.5" />{ciclo.total_obras || 0} obras
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />{ciclo.listo_certificar || 0} listas
              </span>
              <span className="flex items-center gap-1 font-semibold text-primary">
                <DollarSign className="h-3.5 w-3.5" />{fmt(ciclo.monto_total)}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(v => !v)}
              className="gap-1.5 text-xs h-8"
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {expanded ? 'Ocultar' : 'Ver obras'}
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 space-y-2">
            {obras.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No hay obras registradas en este ciclo.</p>
            ) : (
              obras.map(obra => (
                <ObraCertificacionCard
                  key={obra.id}
                  obra={obra}
                  estadoConfig={ESTADO_CONFIG}
                  prioridadConfig={PRIORIDAD_CONFIG}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  onEstadoChange={() => {}}
                  onTramoChange={() => {}}
                  onNotasChange={() => {}}
                  fmt={fmt}
                />
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function HistorialCiclos() {
  const { data: ciclos = [], isLoading } = useQuery({
    queryKey: ['ciclos-certificacion-historico'],
    queryFn: () => base44.entities.CicloCertificacion.filter({ activo: false }, '-created_date', 100),
  });

  if (isLoading) return (
    <div className="flex justify-center py-12">
      <div className="h-6 w-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (ciclos.length === 0) return (
    <div className="text-center py-12 text-muted-foreground text-sm">
      <Calendar className="h-10 w-10 mx-auto mb-3 opacity-20" />
      <p>No hay ciclos anteriores registrados.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {ciclos.map(ciclo => (
        <CicloHistoricoCard key={ciclo.id} ciclo={ciclo} />
      ))}
    </div>
  );
}