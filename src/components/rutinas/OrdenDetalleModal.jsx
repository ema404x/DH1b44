import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { X, Upload, Save, CheckCircle2, AlertTriangle, Loader2, FileText, AlertCircle, Wrench, ExternalLink } from 'lucide-react';
import { format, addDays } from 'date-fns';
import GenerarOTModal from './GenerarOTModal';

const ESTADO_CFG = {
  pendiente:     { label: 'Pendiente',     cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  en_proceso:    { label: 'En Proceso',    cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  ejecutada:     { label: 'Ejecutada',     cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  vencida:       { label: 'Vencida',       cls: 'bg-red-500/20 text-red-300 border-red-500/30' },
  derivada_tom:  { label: 'Derivada TOM',  cls: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
};

export default function OrdenDetalleModal({ orden, onClose, onUpdated }) {
  const [estado, setEstado] = useState(orden.estado);
  const [matricula, setMatricula] = useState(orden.matricula_profesional || '');
  const [observaciones, setObservaciones] = useState(orden.observaciones || '');
  const [adjuntos, setAdjuntos] = useState(orden.adjuntos || []);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [otGenerada, setOtGenerada] = useState(orden.work_order_id || null);
  const [showGenerarOT, setShowGenerarOT] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      // ── Validaciones ──
      if (payload.estado === 'ejecutada') {
        if (orden.carga_sismesc && adjuntos.length === 0) {
          throw new Error('Esta rutina exige cargar comprobante SISMESC antes de marcar como ejecutada.');
        }
        if (orden.requiere_informe_matriculado && !matricula.trim()) {
          throw new Error('Esta rutina requiere ingresar la matrícula profesional.');
        }
      }

      await base44.entities.OrdenRutina.update(orden.id, payload);

      // Si se ejecuta: actualizar la RutinaEdificio (usar frecuencia ya denormalizada)
      if (payload.estado === 'ejecutada' && orden.rutina_edificio_id) {
        const hoy = format(new Date(), 'yyyy-MM-dd');
        const frecDias = orden.frecuencia_dias || 30;
        const proxima = format(addDays(new Date(), frecDias), 'yyyy-MM-dd');
        await base44.entities.RutinaEdificio.update(orden.rutina_edificio_id, {
          ultima_ejecucion: hoy,
          proxima_ejecucion: proxima,
        });
      }
    },
    onSuccess: () => {
      toast.success('Orden actualizada correctamente');
      onUpdated();
    },
    onError: (err) => toast.error(err.message || 'Error al guardar'),
  });

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const newAdj = [...adjuntos, { nombre: file.name, url: file_url, tipo: file.type }];
      setAdjuntos(newAdj);
      // Guardar adjunto + estado y matrícula actuales para no perder cambios en curso
      await base44.entities.OrdenRutina.update(orden.id, {
        adjuntos: newAdj,
        estado,
        matricula_profesional: matricula.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
      });
      toast.success(`Adjunto "${file.name}" cargado`);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSave = () => {
    const payload = {
      estado,
      adjuntos,
      observaciones: observaciones.trim() || undefined,
      matricula_profesional: matricula.trim() || undefined,
      ...(estado === 'ejecutada' ? { fecha_ejecucion: format(new Date(), 'yyyy-MM-dd') } : {}),
    };
    saveMutation.mutate(payload);
  };

  const eCfg = ESTADO_CFG[estado] || ESTADO_CFG.pendiente;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl flex flex-col max-h-[90dvh]"
        style={{ background: 'linear-gradient(135deg, #0A2540 0%, #0d2e4a 100%)' }}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-white/10"
          style={{ background: 'rgba(212,175,55,0.08)' }}>
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className={`text-[10px] border ${eCfg.cls}`}>{eCfg.label}</Badge>
              <span className="text-xs text-white/40">{orden.ciclo}</span>
            </div>
            <h2 className="text-lg font-bold text-white leading-tight">{orden.rutina_objeto}</h2>
            <p className="text-sm text-white/50 mt-0.5">{orden.edificio_nombre} · {orden.rubro_nombre}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/60 transition-colors flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Acciones */}
          {orden.acciones && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: '#D4AF37' }}>Acciones a realizar</p>
              <p className="text-sm text-white/80 leading-relaxed bg-white/5 rounded-xl px-4 py-3 border border-white/8">{orden.acciones}</p>
            </div>
          )}

          {/* TOM */}
          {orden.observaciones_tom && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-amber-400 mb-1.5 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Observaciones TOM / APH
              </p>
              <p className="text-sm text-amber-200/80">{orden.observaciones_tom}</p>
            </div>
          )}

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Fecha Generada', value: orden.fecha_generada },
              { label: 'Fecha Límite (SLA)', value: orden.fecha_limite },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/5 rounded-xl px-4 py-3 border border-white/8">
                <p className="text-[10px] text-white/40 uppercase tracking-wider">{label}</p>
                <p className="text-sm font-semibold text-white mt-1 tabular-nums">{value || '—'}</p>
              </div>
            ))}
          </div>

          {/* Estado */}
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold mb-2 text-white/50">Estado</p>
            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger className="bg-white/5 border-white/15 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ESTADO_CFG).map(([v, c]) => (
                  <SelectItem key={v} value={v}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Matrícula — solo si es requerida */}
          {orden.requiere_informe_matriculado && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5 text-white/50">
                <FileText className="h-3.5 w-3.5" /> Matrícula Profesional <span className="text-red-400">*</span>
              </p>
              <Input
                placeholder="Ej: Mat. 47.892 CPAU"
                value={matricula}
                onChange={e => setMatricula(e.target.value)}
                className="bg-white/5 border-white/15 text-white placeholder:text-white/30"
              />
            </div>
          )}

          {/* Adjuntos SISMESC */}
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5 text-white/50">
              <Upload className="h-3.5 w-3.5" />
              Adjuntos / Comprobantes
              {orden.carga_sismesc && <span className="text-emerald-400 ml-1">(SISMESC requerido)</span>}
            </p>
            {adjuntos.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {adjuntos.map((a, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 border border-white/8">
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-300 hover:underline truncate flex-1">{a.nombre}</a>
                    <button onClick={() => setAdjuntos(prev => prev.filter((_, j) => j !== i))}
                      className="text-white/30 hover:text-red-400 transition-colors ml-2">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="cursor-pointer flex items-center gap-2 text-sm border border-dashed border-white/20 hover:border-yellow-500/50 rounded-xl px-4 py-3 transition-colors text-white/50 hover:text-white/80">
              {uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploadingFile ? 'Subiendo…' : 'Adjuntar archivo'}
              <input type="file" className="hidden" onChange={handleUpload} disabled={uploadingFile} />
            </label>
          </div>

          {/* Observaciones */}
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold mb-2 text-white/50">Observaciones</p>
            <textarea
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              placeholder="Agregar observaciones de ejecución…"
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 resize-none outline-none focus:border-yellow-500/40 min-h-[80px]"
            />
          </div>

          {/* OT vinculada */}
          {otGenerada && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-emerald-300">Orden de trabajo generada</p>
                <p className="text-[11px] text-emerald-200/60 truncate">ID: {otGenerada}</p>
              </div>
              <a
                href="/ordenes"
                className="text-xs font-semibold flex items-center gap-1 text-emerald-300 hover:text-emerald-100 transition-colors"
              >
                Ver OT <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Validaciones alertas */}
          {estado === 'ejecutada' && orden.carga_sismesc && adjuntos.length === 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              Debés adjuntar el comprobante SISMESC antes de marcar como ejecutada.
            </div>
          )}
          {estado === 'ejecutada' && orden.requiere_informe_matriculado && !matricula.trim() && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              Debés ingresar la matrícula profesional antes de marcar como ejecutada.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/10 bg-black/20">
          <div className="flex items-center gap-2">
            {/* Generar OT */}
            {!otGenerada && (estado === 'pendiente' || estado === 'en_proceso' || estado === 'vencida') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGenerarOT(true)}
                className="gap-2 border-yellow-500/40 hover:bg-yellow-500/10 font-semibold"
                style={{ color: '#D4AF37', borderColor: 'rgba(212,175,55,0.4)' }}
              >
                <Wrench className="h-3.5 w-3.5" />
                Generar OT
              </Button>
            )}
            {/* Derivar a TOM */}
            {orden.observaciones_tom && estado !== 'derivada_tom' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEstado('derivada_tom')}
                className="gap-2 border-purple-500/40 text-purple-300 hover:bg-purple-500/10"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Derivar a TOM
              </Button>
            )}
          </div>
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-white/50 hover:text-white">Cancelar</Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="gap-2 font-bold"
              style={{ background: '#D4AF37', color: '#0A2540' }}
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar
            </Button>
          </div>
        </div>
      </div>

      {showGenerarOT && (
        <GenerarOTModal
          orden={orden}
          onClose={() => setShowGenerarOT(false)}
          onCreated={(ot) => {
            setOtGenerada(ot.id);
            setEstado('en_proceso');
            setShowGenerarOT(false);
          }}
        />
      )}
    </div>
  );
}