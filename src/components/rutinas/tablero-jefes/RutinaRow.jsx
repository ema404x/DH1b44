import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { differenceInDays, parseISO, format, addDays } from 'date-fns';
import {
  AlertTriangle, Clock, CheckCircle2, Zap, Shield, ClipboardList,
  Wrench, ChevronRight, Loader2, ExternalLink
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import OrdenDetalleModal from '../OrdenDetalleModal';

const ESTADO_CFG = {
  pendiente:    { label: 'Pendiente',    cls: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25', dot: 'bg-yellow-400' },
  en_proceso:   { label: 'En Proceso',  cls: 'bg-blue-500/15 text-blue-300 border-blue-500/25',    dot: 'bg-blue-400' },
  vencida:      { label: 'Vencida',     cls: 'bg-red-500/15 text-red-300 border-red-500/25',       dot: 'bg-red-500' },
  derivada_tom: { label: 'TOM',         cls: 'bg-purple-500/15 text-purple-300 border-purple-500/25', dot: 'bg-purple-400' },
};

function SemaforoFecha({ fechaLimite, estado }) {
  if (!fechaLimite || estado === 'derivada_tom') return null;
  const hoy = new Date();
  const limite = parseISO(fechaLimite);
  const dias = differenceInDays(limite, hoy);

  if (estado === 'vencida' || dias < 0) {
    return <span className="text-[10px] font-bold text-red-400 tabular-nums">Vencida hace {Math.abs(dias)}d</span>;
  }
  if (dias === 0) return <span className="text-[10px] font-bold text-red-400">Vence hoy</span>;
  if (dias <= 3) return <span className="text-[10px] font-semibold text-yellow-400 tabular-nums">Vence en {dias}d</span>;
  return <span className="text-[10px] text-white/30 tabular-nums">{fechaLimite}</span>;
}

export default function RutinaRow({ orden, onUpdated }) {
  const [showDetalle, setShowDetalle] = useState(false);
  const qc = useQueryClient();

  const markDoneMutation = useMutation({
    mutationFn: async () => {
      if (orden.carga_sismesc) throw new Error('Requiere comprobante SISMESC — abrir detalle.');
      if (orden.requiere_informe_matriculado) throw new Error('Requiere matrícula profesional — abrir detalle.');
      await base44.entities.OrdenRutina.update(orden.id, {
        estado: 'ejecutada',
        fecha_ejecucion: format(new Date(), 'yyyy-MM-dd'),
      });
      if (orden.rutina_edificio_id) {
        await base44.entities.RutinaEdificio.update(orden.rutina_edificio_id, {
          ultima_ejecucion: format(new Date(), 'yyyy-MM-dd'),
          proxima_ejecucion: format(addDays(new Date(), orden.frecuencia_dias || 30), 'yyyy-MM-dd'),
        });
      }
    },
    onSuccess: () => {
      toast.success(`✓ ${orden.rutina_objeto} marcada como ejecutada`);
      onUpdated();
    },
    onError: (err) => toast.error(err.message),
  });

  const cfg = ESTADO_CFG[orden.estado] || ESTADO_CFG.pendiente;
  const hoy = new Date();
  const diasRestantes = orden.fecha_limite ? differenceInDays(parseISO(orden.fecha_limite), hoy) : null;
  const isUrgente = orden.estado === 'vencida' || (diasRestantes !== null && diasRestantes <= 3);

  return (
    <>
      <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 mb-1.5 border transition-all group
        ${isUrgente ? 'border-red-500/20 bg-red-500/5' : 'border-white/5 bg-white/3 hover:bg-white/6'}`}>

        {/* Dot estado */}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />

        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-1.5 flex-wrap">
            <p className="text-xs font-medium text-white/90 leading-snug">{orden.rutina_objeto}</p>
            {orden.requiere_informe_matriculado && (
              <Shield className="h-3 w-3 text-purple-400 flex-shrink-0 mt-0.5" title="Requiere matriculado" />
            )}
            {orden.carga_sismesc && (
              <ClipboardList className="h-3 w-3 text-blue-400 flex-shrink-0 mt-0.5" title="Carga SISMESC requerida" />
            )}
            {orden.work_order_id && (
              <Wrench className="h-3 w-3 text-emerald-400 flex-shrink-0 mt-0.5" title="OT generada" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] text-white/30">{orden.rubro_nombre}</span>
            <span className="text-[10px] text-white/20">·</span>
            <Badge variant="outline" className={`text-[9px] border py-0 px-1 h-4 ${cfg.cls}`}>{cfg.label}</Badge>
            <span className="text-[10px] text-white/25">{orden.ciclo}</span>
          </div>
        </div>

        {/* Fecha */}
        <div className="hidden sm:block flex-shrink-0 text-right">
          <SemaforoFecha fechaLimite={orden.fecha_limite} estado={orden.estado} />
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Marcar ejecutada rápida (solo si no requiere doc) */}
          {(orden.estado === 'pendiente' || orden.estado === 'en_proceso') && (
            <button
              onClick={() => markDoneMutation.mutate()}
              disabled={markDoneMutation.isPending}
              title="Marcar como ejecutada"
              className="h-6 w-6 rounded-lg flex items-center justify-center bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 transition-colors"
            >
              {markDoneMutation.isPending
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <CheckCircle2 className="h-3 w-3" />
              }
            </button>
          )}
          {/* Abrir detalle */}
          <button
            onClick={() => setShowDetalle(true)}
            title="Ver detalle"
            className="h-6 w-6 rounded-lg flex items-center justify-center bg-white/8 hover:bg-white/15 text-white/50 hover:text-white transition-colors"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {showDetalle && (
        <OrdenDetalleModal
          orden={orden}
          onClose={() => setShowDetalle(false)}
          onUpdated={() => { setShowDetalle(false); onUpdated(); }}
        />
      )}
    </>
  );
}