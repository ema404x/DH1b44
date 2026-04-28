import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle, Clock, MapPin, User, CheckCircle2, Loader2, ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const TIPO_CONFIG = {
  incendio: { emoji: '🔥', color: 'bg-red-500/20 text-red-300 border-red-500/50' },
  inundacion: { emoji: '💧', color: 'bg-blue-500/20 text-blue-300 border-blue-500/50' },
  corte_electrico: { emoji: '⚡', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50' },
  derrumbe: { emoji: '🧱', color: 'bg-orange-500/20 text-orange-300 border-orange-500/50' },
  rotura_gas: { emoji: '💨', color: 'bg-purple-500/20 text-purple-300 border-purple-500/50' },
  vandalismo: { emoji: '🚨', color: 'bg-pink-500/20 text-pink-300 border-pink-500/50' },
  accidente: { emoji: '🏥', color: 'bg-rose-500/20 text-rose-300 border-rose-500/50' },
  otro: { emoji: '⚠️', color: 'bg-slate-500/20 text-slate-300 border-slate-500/50' },
};

const ESTADO_CONFIG = {
  activa: { label: 'ACTIVA', class: 'bg-red-500 text-white animate-pulse' },
  en_atencion: { label: 'En Atención', class: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50' },
  resuelta: { label: 'Resuelta', class: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50' },
  cancelada: { label: 'Cancelada', class: 'bg-slate-500/20 text-slate-400 border border-slate-500/50' },
};

export default function EmergenciaCard({ emergencia, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  const tipo = TIPO_CONFIG[emergencia.tipo] || TIPO_CONFIG.otro;
  const estado = ESTADO_CONFIG[emergencia.estado] || ESTADO_CONFIG.activa;

  const cambiarEstado = async (nuevoEstado) => {
    setSaving(true);
    const updates = { estado: nuevoEstado };
    if (nuevoEstado === 'resuelta') {
      updates.fecha_resolucion = new Date().toISOString();
      const created = new Date(emergencia.created_date);
      updates.tiempo_respuesta_min = Math.round((Date.now() - created.getTime()) / 60000);
    }
    await base44.entities.Emergencia.update(emergencia.id, updates);
    if (emergencia.work_order_id && nuevoEstado === 'resuelta') {
      await base44.entities.WorkOrder.update(emergencia.work_order_id, { status: 'completada' });
    }
    setSaving(false);
    toast.success(`Emergencia marcada como ${nuevoEstado}`);
    onUpdate?.();
  };

  const tiempoTranscurrido = formatDistanceToNow(new Date(emergencia.created_date), { locale: es, addSuffix: true });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border backdrop-blur overflow-hidden ${
        emergencia.estado === 'activa'
          ? 'border-red-500/50 bg-gradient-to-r from-red-500/10 to-slate-800/80 shadow-lg shadow-red-500/10'
          : emergencia.estado === 'en_atencion'
          ? 'border-yellow-500/30 bg-slate-800/60'
          : 'border-slate-700/50 bg-slate-800/40'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Emoji tipo */}
          <div className="text-2xl flex-shrink-0 mt-0.5">{tipo.emoji}</div>

          {/* Info principal */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${estado.class}`}>
                {estado.label}
              </span>
              <Badge className={`text-xs ${tipo.color}`}>{emergencia.tipo?.replace('_', ' ')}</Badge>
              <span className="text-xs text-slate-500">{emergencia.codigo}</span>
            </div>
            <h3 className="font-bold text-white text-sm sm:text-base">{emergencia.titulo}</h3>
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-400">
              {emergencia.establecimiento && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />{emergencia.establecimiento}
                </span>
              )}
              {emergencia.jefe_sitio_asignado && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />{emergencia.jefe_sitio_asignado}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />{tiempoTranscurrido}
              </span>
            </div>
          </div>

          {/* Acciones rápidas */}
          <div className="flex flex-col gap-1 flex-shrink-0">
            {emergencia.estado === 'activa' && (
              <Button size="sm" onClick={() => cambiarEstado('en_atencion')} disabled={saving} className="bg-yellow-600 hover:bg-yellow-700 text-white text-xs h-7 px-2">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Atender'}
              </Button>
            )}
            {emergencia.estado === 'en_atencion' && (
              <Button size="sm" onClick={() => cambiarEstado('resuelta')} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <><CheckCircle2 className="h-3 w-3" /> Resolver</>}
              </Button>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-slate-400 hover:text-slate-300 transition-colors p-1 rounded"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Detalle expandible */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-700/50"
          >
            <div className="p-4 space-y-3">
              {emergencia.descripcion && (
                <p className="text-sm text-slate-300">{emergencia.descripcion}</p>
              )}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {emergencia.reportado_por && (
                  <div>
                    <p className="text-slate-500 mb-0.5">Reportado por</p>
                    <p className="text-slate-300">{emergencia.reportado_por}</p>
                  </div>
                )}
                {emergencia.telefono_contacto && (
                  <div>
                    <p className="text-slate-500 mb-0.5">Teléfono</p>
                    <p className="text-slate-300">{emergencia.telefono_contacto}</p>
                  </div>
                )}
                {emergencia.comuna && (
                  <div>
                    <p className="text-slate-500 mb-0.5">Comuna</p>
                    <p className="text-slate-300">{emergencia.comuna}</p>
                  </div>
                )}
                {emergencia.tiempo_respuesta_min && (
                  <div>
                    <p className="text-slate-500 mb-0.5">Tiempo respuesta</p>
                    <p className="text-slate-300">{emergencia.tiempo_respuesta_min} min</p>
                  </div>
                )}
              </div>
              {emergencia.fotos?.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {emergencia.fotos.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt="" className="h-16 w-16 object-cover rounded-lg border border-slate-700 hover:opacity-80 transition-opacity" />
                    </a>
                  ))}
                </div>
              )}
              {emergencia.work_order_id && (
                <div className="pt-1">
                  <a
                    href="/ordenes"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />Ver Orden de Trabajo vinculada
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}