import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, CheckCircle2, XCircle, MapPin, Package, AlertTriangle, Clock, Camera, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

export default function ValidacionJefePanel() {
  const [actionOT, setActionOT] = useState(null); // { ot, accion: 'aprobar'|'rechazar' }
  const [rechazoComentario, setRechazoComentario] = useState('');
  const [processing, setProcessing] = useState(null);
  const queryClient = useQueryClient();

  const { data: allOTs = [], isLoading } = useQuery({
    queryKey: ['workorders-validacion'],
    queryFn: () => base44.entities.WorkOrder.list('-created_date', 500),
    staleTime: 1000 * 60 * 3,
  });

  const otPendientes = useMemo(
    () => allOTs.filter(ot => ot.status === 'pendiente_validacion'),
    [allOTs]
  );

  const ejecutarAccion = async (ot, accion) => {
    setProcessing(ot.id);
    try {
      const extraData = {};
      if (accion === 'rechazar') {
        extraData.rechazo_comentario = rechazoComentario;
      }
      const res = await base44.functions.invoke('transicionEstadoOT', {
        ot_id: ot.id,
        accion,
        extra_data: extraData,
      });
      toast.success(res.data.mensaje);
      queryClient.invalidateQueries({ queryKey: ['workorders-validacion'] });
      queryClient.invalidateQueries({ queryKey: ['workorders-operario'] });
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'intente nuevamente';
      toast.error(msg);
    } finally {
      setProcessing(null);
      setActionOT(null);
      setRechazoComentario('');
    }
  };

  const handleConfirm = () => {
    if (actionOT.accion === 'rechazar' && !rechazoComentario.trim()) {
      toast.error('Debes indicar un motivo de rechazo');
      return;
    }
    ejecutarAccion(actionOT.ot, actionOT.accion);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-amber-400/15 border border-amber-400/25 flex items-center justify-center">
          <Clock className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Validación de OTs</h1>
          <p className="text-xs text-slate-400">{otPendientes.length} pendiente{otPendientes.length !== 1 ? 's' : ''} de validación</p>
        </div>
      </div>

      {otPendientes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
          <CheckCircle2 className="h-12 w-12 text-slate-700" />
          <p className="text-sm font-medium">No hay OTs pendientes de validación</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {otPendientes.map(ot => (
            <OTValidacionCard key={ot.id} ot={ot} onAprobar={() => setActionOT({ ot, accion: 'aprobar' })} onRechazar={() => setActionOT({ ot, accion: 'rechazar' })} processing={processing === ot.id} />
          ))}
        </div>
      )}

      {/* Modal de confirmación */}
      {actionOT && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setActionOT(null); setRechazoComentario(''); }} />
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              {actionOT.accion === 'aprobar' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <XCircle className="h-5 w-5 text-red-400" />
              )}
              <h3 className="text-base font-bold text-white">
                {actionOT.accion === 'aprobar' ? '¿Aprobar OT?' : '¿Rechazar OT?'}
              </h3>
            </div>
            <p className="text-sm text-slate-400 mb-1">OT:</p>
            <p className="text-sm font-medium text-white mb-4 truncate">{actionOT.ot.title}</p>

            {actionOT.accion === 'rechazar' && (
              <div className="mb-4">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                  <MessageSquare className="h-3.5 w-3.5 text-red-400" /> Motivo del rechazo *
                </label>
                <textarea
                  value={rechazoComentario}
                  onChange={e => setRechazoComentario(e.target.value)}
                  rows={3}
                  placeholder="Explicá qué falta o qué debe corregir el operario..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  autoFocus
                />
                <p className="text-[10px] text-slate-500 mt-1">La OT volverá a "En Progreso" y el operario verá este comentario</p>
              </div>
            )}

            {actionOT.accion === 'aprobar' && (
              <p className="text-xs text-slate-500 mb-4">La OT se marcará como completada y no podrá editarse.</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setActionOT(null); setRechazoComentario(''); }}
                disabled={processing}
                className="flex-1 h-11 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={processing}
                className={`flex-1 h-11 rounded-lg text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                  actionOT.accion === 'aprobar'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-red-600 hover:bg-red-500'
                }`}
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : actionOT.accion === 'aprobar' ? 'Aprobar' : 'Rechazar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OTValidacionCard({ ot, onAprobar, onRechazar, processing }) {
  const [expanded, setExpanded] = useState(false);
  const tieneFaltantes = (ot.materiales_faltantes || []).length > 0;
  const tieneFotos = (ot.photos || []).length > 0;
  const tieneMateriales = (ot.materials_used || []).length > 0;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
      {/* Cabecera */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white leading-snug">{ot.title}</h3>
            {ot.assigned_name && (
              <p className="text-xs text-slate-400 mt-0.5">Operario: {ot.assigned_name}</p>
            )}
            {ot.location && (
              <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{ot.location}</span>
              </div>
            )}
          </div>
          <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-amber-400/10 text-amber-400 border-amber-400/20">
            Pendiente
          </span>
        </div>

        {/* Resumen rápido de evidencia */}
        <div className="flex gap-3 mt-3 text-xs">
          {tieneMateriales && (
            <span className="flex items-center gap-1 text-blue-400">
              <Package className="h-3.5 w-3.5" /> {ot.materials_used.length} material{ot.materials_used.length !== 1 ? 'es' : ''}
            </span>
          )}
          {tieneFaltantes && (
            <span className="flex items-center gap-1 text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" /> {ot.materiales_faltantes.length} faltante{ot.materiales_faltantes.length !== 1 ? 's' : ''}
            </span>
          )}
          {tieneFotos && (
            <span className="flex items-center gap-1 text-sky-400">
              <Camera className="h-3.5 w-3.5" /> {ot.photos.length} foto{ot.photos.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Expandir detalles */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-primary hover:underline mt-2"
        >
          {expanded ? 'Ocultar detalles' : 'Ver detalles del reporte'}
        </button>
      </div>

      {/* Detalle expandible */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-800 pt-3">
          {/* Materiales usados */}
          {tieneMateriales && (
            <div>
              <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Package className="h-3 w-3 text-blue-400" /> Materiales Usados
              </p>
              {ot.materials_used.map((m, i) => (
                <div key={i} className="flex justify-between text-xs text-slate-300 py-0.5">
                  <span>{m.material_name}</span>
                  <span className="tabular-nums text-slate-400">{m.quantity}u</span>
                </div>
              ))}
            </div>
          )}

          {/* Materiales faltantes */}
          {tieneFaltantes && (
            <div>
              <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-400" /> Materiales Faltantes
              </p>
              {ot.materiales_faltantes.map((m, i) => (
                <div key={i} className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 mb-1">
                  <div className="flex justify-between text-xs text-amber-200">
                    <span>{m.material_name}</span>
                    <span className="tabular-nums">{m.cantidad_faltante}u</span>
                  </div>
                  {m.motivo && <p className="text-[10px] text-amber-400/80 mt-0.5">{m.motivo}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Fotos */}
          {tieneFotos && (
            <div>
              <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Camera className="h-3 w-3 text-sky-400" /> Fotos
              </p>
              <div className="flex gap-2 flex-wrap">
                {ot.photos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={`foto ${i+1}`} className="w-16 h-16 rounded-lg object-cover border border-slate-700 hover:border-primary transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Notas */}
          {ot.notes && (
            <div>
              <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wide mb-1">Observaciones del operario</p>
              <p className="text-xs text-slate-300 bg-slate-800/50 rounded-lg p-2">{ot.notes}</p>
            </div>
          )}

          {/* GPS */}
          {ot.gps_status === 'capturado' && ot.gps_latitude && (
            <div>
              <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wide mb-1 flex items-center gap-1">
                <MapPin className="h-3 w-3 text-emerald-400" /> Ubicación de inicio
              </p>
              <a
                href={`https://www.google.com/maps?q=${ot.gps_latitude},${ot.gps_longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                Ver en Google Maps
              </a>
            </div>
          )}
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex gap-2 p-3 border-t border-slate-800 bg-slate-900/40">
        <button
          onClick={onRechazar}
          disabled={processing}
          className="flex-1 h-11 rounded-lg bg-red-600/20 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-600/30 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <XCircle className="h-4 w-4" />
          Rechazar
        </button>
        <button
          onClick={onAprobar}
          disabled={processing}
          className="flex-1 h-11 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Aprobar
        </button>
      </div>
    </div>
  );
}