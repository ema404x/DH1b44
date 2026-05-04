import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Loader2, Zap, CheckCircle2, AlertCircle, FileText, Upload, X, UploadCloud
} from 'lucide-react';

const ESTADOS = {
  pendiente: { label: 'Pendiente', color: 'text-muted-foreground', icon: FileText },
  subiendo:  { label: 'Subiendo...', color: 'text-blue-500',    icon: Loader2, spin: true },
  extrayendo:{ label: 'Extrayendo con IA...', color: 'text-violet-500', icon: Loader2, spin: true },
  guardando: { label: 'Guardando...', color: 'text-blue-500',   icon: Loader2, spin: true },
  ok:        { label: 'Certificado generado', color: 'text-emerald-600', icon: CheckCircle2 },
  error:     { label: 'Error', color: 'text-destructive',       icon: AlertCircle },
};

export default function GeneracionMasiva({ open, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const inputRef = useRef(null);
  const [archivos, setArchivos] = useState([]); // [{file, estado, certNumero, error}]
  const [running, setRunning] = useState(false);
  const [drag, setDrag] = useState(false);
  const [comunaFiltro, setComunaFiltro] = useState('Todas');

  const detectarComuna = (nombre) => {
    const n = nombre.toUpperCase();
    if (n.includes('8A') || n.includes('8 A') || n.includes('COMUNA8A')) return '8A';
    if (n.includes('8B') || n.includes('8 B') || n.includes('COMUNA8B')) return '8B';
    if (n.includes('10A') || n.includes('10 A') || n.includes('COMUNA10A')) return '10A';
    return 'Sin asignar';
  };

  const addFiles = (files) => {
    const nuevos = Array.from(files)
      .filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
      .map(file => ({
        file,
        estado: 'pendiente',
        certNumero: null,
        error: null,
        comuna: detectarComuna(file.name),
      }));
    setArchivos(prev => [...prev, ...nuevos]);
  };

  const removeFile = (idx) => {
    setArchivos(prev => prev.filter((_, i) => i !== idx));
  };

  const procesarArchivo = async (idx, lastNum) => {
    const setEstado = (estado, extra = {}) =>
      setArchivos(prev => prev.map((a, i) => i === idx ? { ...a, estado, ...extra } : a));

    const archivo = archivos[idx];

    // 1. Subir el archivo
    setEstado('subiendo');
    const { file_url } = await base44.integrations.Core.UploadFile({ file: archivo.file });

    // 2. Extraer datos con IA
    setEstado('extrayendo');
    const res = await base44.functions.invoke('extractADA', { file_url });
    const data = res.data?.data || res.data;

    // 3. Guardar certificado
    setEstado('guardando');
    const certNum = lastNum + idx + 1;
    const newCert = {
      numero: certNum,
      tipo: 'abono_mensual',
      estado: 'emitido',
      generado_automaticamente: false,
      emprendimiento: data.emprendimiento || '',
      obra_servicio: data.obra_servicio || '',
      contratista: data.contratista || '',
      ada_numero: data.ada_numero || '',
      oc_numero: data.oc_numero || '',
      mes_periodo: data.mes_periodo || '',
      fecha_inicio: data.fecha_inicio || '',
      plazo_obra: data.plazo_obra || '',
      plazo_entrega: data.plazo_entrega || '',
      monto_contratado: data.monto_contratado || data.subtotal || 0,
      monto_obra_contratada: data.monto_obra_contratada || 0,
      porcentaje_avance: data.porcentaje_avance || 0,
      condiciones_pago: data.condiciones_pago || '',
      fecha_certificado: new Date().toISOString().split('T')[0],
      items: data.items || [],
      subtotal: data.subtotal || 0,
      anticipo_pct: 0,
      fondo_reparo_pct: 5,
      ada_pdf_url: file_url,
    };

    await base44.entities.Certificado.create(newCert);
    setEstado('ok', { certNumero: certNum });
  };

  const handleGenerar = async () => {
    if (!archivos.length || running) return;
    setRunning(true);

    // Obtener último número de certificado base
    const allCerts = await base44.entities.Certificado.list('-numero', 1);
    const lastNum = allCerts.length > 0 ? (allCerts[0].numero || 0) : 0;

    // Procesar todos en paralelo
    const promises = archivos.map((_, idx) =>
      procesarArchivo(idx, lastNum).catch(err => {
        setArchivos(prev => prev.map((a, i) =>
          i === idx ? { ...a, estado: 'error', error: err.message || 'Error desconocido' } : a
        ));
      })
    );

    await Promise.all(promises);

    queryClient.invalidateQueries({ queryKey: ['certificados'] });
    setRunning(false);
    if (onSuccess) onSuccess();
  };

  const limpiar = () => {
    setArchivos([]);
    setRunning(false);
  };

  const archivosFiltrados = comunaFiltro === 'Todas'
    ? archivos
    : archivos.filter(a => (a.comuna || 'Sin asignar') === comunaFiltro);

  const comunas = ['Todas', ...Array.from(new Set(archivos.map(a => a.comuna || 'Sin asignar')))];

  const terminados = archivos.filter(a => a.estado === 'ok').length;
  const conError = archivos.filter(a => a.estado === 'error').length;
  const todosTerminados = archivos.length > 0 && archivos.every(a => a.estado === 'ok' || a.estado === 'error');

  return (
    <Dialog open={open} onOpenChange={() => { if (!running) { limpiar(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-violet-500" />
            Generación Masiva desde PDFs
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* Drop zone */}
          {!running && (
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                drag ? 'border-violet-500 bg-violet-50/10' : 'border-border hover:border-violet-400 hover:bg-muted/20'
              }`}
            >
              <UploadCloud className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-semibold text-sm">Arrastrá los PDFs acá o hacé click</p>
              <p className="text-xs text-muted-foreground mt-1">Podés subir hasta 20 archivos PDF a la vez</p>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,application/pdf"
                multiple
                className="hidden"
                onChange={e => addFiles(e.target.files)}
              />
            </div>
          )}

          {/* Filtro por comuna */}
          {archivos.length > 0 && comunas.length > 2 && (
            <div className="flex gap-1.5 flex-wrap">
              {comunas.map(c => (
                <button
                  key={c}
                  onClick={() => setComunaFiltro(c)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                    comunaFiltro === c
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'border-border text-muted-foreground hover:border-violet-400'
                  }`}
                >
                  {c} {c !== 'Todas' ? `(${archivos.filter(a => (a.comuna || 'Sin asignar') === c).length})` : `(${archivos.length})`}
                </button>
              ))}
            </div>
          )}

          {/* Lista de archivos */}
          {archivos.length > 0 && (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 border rounded-xl p-3">
              {archivosFiltrados.map((a, _) => {
                const idx = archivos.indexOf(a);
                const cfg = ESTADOS[a.estado] || ESTADOS.pendiente;
                const Icon = cfg.icon;
                return (
                  <div key={idx} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/20 border border-border/40">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.file.name}</p>
                      {a.estado === 'error' && a.error && (
                        <p className="text-xs text-destructive truncate">{a.error}</p>
                      )}
                      {a.estado === 'ok' && a.certNumero && (
                        <p className="text-xs text-emerald-600">Certificado N° {a.certNumero}</p>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                      a.comuna === '8A' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      a.comuna === '8B' ? 'bg-violet-50 text-violet-700 border-violet-200' :
                      a.comuna === '10A' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      'bg-muted text-muted-foreground border-border'
                    }`}>
                      {a.comuna || 'Sin asignar'}
                    </span>
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${cfg.color} shrink-0`}>
                      <Icon className={`h-3.5 w-3.5 ${cfg.spin ? 'animate-spin' : ''}`} />
                      <span>{cfg.label}</span>
                    </div>
                    {!running && a.estado === 'pendiente' && (
                      <button onClick={() => removeFile(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Resumen post-proceso */}
          {todosTerminados && (
            <div className={`rounded-lg p-3 border text-sm flex items-center gap-3 ${
              conError === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              {conError === 0 ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              <span>
                {terminados} certificado{terminados !== 1 ? 's' : ''} generado{terminados !== 1 ? 's' : ''}
                {conError > 0 && ` · ${conError} con error`}
              </span>
            </div>
          )}

          {/* Acciones */}
          <div className="flex gap-2 pt-1 border-t">
            <Button
              variant="outline"
              onClick={() => { limpiar(); onClose(); }}
              disabled={running}
              className="flex-1"
            >
              {todosTerminados ? 'Cerrar' : 'Cancelar'}
            </Button>
            {!todosTerminados && (
              <Button
                onClick={handleGenerar}
                disabled={archivos.length === 0 || running}
                className="flex-1 gap-2 bg-violet-600 hover:bg-violet-700"
              >
                {running
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Procesando {terminados}/{archivos.length}...</>
                  : <><Zap className="h-4 w-4" />Generar {archivos.length > 0 ? `${archivos.length} certificado${archivos.length !== 1 ? 's' : ''}` : ''}</>
                }
              </Button>
            )}
            {todosTerminados && archivos.some(a => a.estado === 'error') && (
              <Button onClick={limpiar} variant="outline" className="flex-1">
                Intentar de nuevo
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}