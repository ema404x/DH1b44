import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Sparkles, ClipboardList, Trash2, Check, AlertTriangle, Wrench, Zap } from 'lucide-react';
import { toast } from 'sonner';

const PRIORIDAD_CFG = {
  urgente: { label: 'Urgente', cls: 'bg-red-900/60 text-red-300 border-red-700' },
  alta:    { label: 'Alta',    cls: 'bg-orange-900/60 text-orange-300 border-orange-700' },
  media:   { label: 'Media',  cls: 'bg-yellow-900/60 text-yellow-300 border-yellow-700' },
  baja:    { label: 'Baja',   cls: 'bg-slate-800 text-slate-400 border-slate-600' },
};

const TIPO_CFG = {
  mantenimiento_correctivo: 'Correctivo',
  mantenimiento_preventivo: 'Preventivo',
  reparacion: 'Reparación',
  inspeccion: 'Inspección',
};

export default function GenerarOTsModal({ open, onClose, informe, establecimiento, jefesSitio = '' }) {
  const [paso, setPaso] = useState('idle'); // idle | extrayendo | revisando | creando | listo
  const [ots, setOts] = useState([]);
  const [seleccionadas, setSeleccionadas] = useState(new Set());
  const [creadas, setCreadas] = useState(0);

  const handleExtraer = async () => {
    setPaso('extrayendo');
    try {
      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt: `Analizá el siguiente informe técnico de inspección edilicia y extraé TODOS los hallazgos que requieren una orden de trabajo (mantenimiento, reparación, intervención).

Para cada hallazgo generá un objeto JSON con estos campos:
- title: título breve de la OT (máx 80 caracteres)
- description: descripción técnica del trabajo a realizar (2-3 oraciones)
- type: uno de "mantenimiento_correctivo", "mantenimiento_preventivo", "reparacion", "inspeccion"
- priority: uno de "urgente", "alta", "media", "baja" (basado en 🔴=urgente, 🟠=alta, 🟡=media, 🟢=baja)
- location: ubicación específica dentro del establecimiento (ej: "Baño planta baja", "Aula 12")

Solo incluí hallazgos concretos que requieran intervención. Ignorá observaciones de estado "Bueno" o "sin problemas".
Establecimiento: ${establecimiento}

INFORME:
${informe.slice(0, 6000)}`,
        response_json_schema: {
          type: 'object',
          properties: {
            ordenes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  type: { type: 'string' },
                  priority: { type: 'string' },
                  location: { type: 'string' },
                },
              },
            },
          },
        },
      });

      const ordenes = resultado?.ordenes || [];
      if (ordenes.length === 0) {
        toast.info('No se detectaron hallazgos que requieran OTs.');
        setPaso('idle');
        return;
      }

      setOts(ordenes.map((o, i) => ({ ...o, _id: i, location: o.location || establecimiento })));
      setSeleccionadas(new Set(ordenes.map((_, i) => i)));
      setPaso('revisando');
    } catch (e) {
      toast.error('Error al analizar el informe: ' + e.message);
      setPaso('idle');
    }
  };

  const toggleSeleccion = (id) => {
    setSeleccionadas(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCampo = (id, campo, valor) => {
    setOts(prev => prev.map(o => o._id === id ? { ...o, [campo]: valor } : o));
  };

  const handleEliminar = (id) => {
    setOts(prev => prev.filter(o => o._id !== id));
    setSeleccionadas(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  const handleCrear = async () => {
    const aCrear = ots.filter(o => seleccionadas.has(o._id));
    if (aCrear.length === 0) return toast.warning('Seleccioná al menos una OT');
    setPaso('creando');
    let count = 0;
    for (const ot of aCrear) {
      await base44.entities.WorkOrder.create({
        title: ot.title,
        description: ot.description,
        type: ot.type || 'mantenimiento_correctivo',
        priority: ot.priority || 'media',
        status: 'pendiente',
        location: ot.location || establecimiento,
        notes: `OT generada automáticamente desde Inspección Edilicia - ${establecimiento}`,
      });
      count++;
    }
    setCreadas(count);
    setPaso('listo');
    toast.success(`${count} orden${count !== 1 ? 'es' : ''} de trabajo creada${count !== 1 ? 's' : ''}`);
  };

  const handleCerrar = () => {
    setPaso('idle');
    setOts([]);
    setSeleccionadas(new Set());
    setCreadas(0);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleCerrar}>
      <DialogContent className="max-w-2xl max-h-[90dvh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wrench className="h-4 w-4 text-primary" />
            </div>
            Generar OTs desde el informe
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            La IA analizará el informe y propondrá órdenes de trabajo para cada hallazgo detectado.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Estado: idle */}
          {paso === 'idle' && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-base">Análisis automático de hallazgos</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Vamos a leer el informe generado y extraer todos los problemas que necesitan una orden de trabajo.
                </p>
              </div>
              <Button onClick={handleExtraer} className="gap-2 mt-2">
                <Sparkles className="h-4 w-4" /> Analizar informe
              </Button>
            </div>
          )}

          {/* Estado: extrayendo */}
          {paso === 'extrayendo' && (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="font-semibold">Analizando informe...</p>
              <p className="text-sm text-muted-foreground">Detectando hallazgos y clasificando prioridades</p>
            </div>
          )}

          {/* Estado: revisando */}
          {paso === 'revisando' && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {ots.length} OT{ots.length !== 1 ? 's' : ''} detectada{ots.length !== 1 ? 's' : ''} ·{' '}
                  <span className="text-primary">{seleccionadas.size} seleccionada{seleccionadas.size !== 1 ? 's' : ''}</span>
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setSeleccionadas(new Set(ots.map(o => o._id)))}
                    className="text-xs text-primary hover:underline">Todas</button>
                  <span className="text-muted-foreground">·</span>
                  <button onClick={() => setSeleccionadas(new Set())}
                    className="text-xs text-muted-foreground hover:underline">Ninguna</button>
                </div>
              </div>

              <div className="space-y-3">
                {ots.map((ot) => {
                  const sel = seleccionadas.has(ot._id);
                  const pCfg = PRIORIDAD_CFG[ot.priority] || PRIORIDAD_CFG.media;
                  return (
                    <div
                      key={ot._id}
                      className={`rounded-xl border p-3.5 transition-all ${
                        sel ? 'border-primary/50 bg-primary/5' : 'border-border bg-card opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleSeleccion(ot._id)}
                          className={`mt-0.5 h-5 w-5 rounded shrink-0 border-2 flex items-center justify-center transition-all ${
                            sel ? 'bg-primary border-primary' : 'border-border bg-transparent'
                          }`}
                        >
                          {sel && <Check className="h-3 w-3 text-white" />}
                        </button>

                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Título editable */}
                          <Input
                            value={ot.title}
                            onChange={e => handleCampo(ot._id, 'title', e.target.value)}
                            className="h-8 text-sm font-semibold bg-transparent border-0 border-b border-border rounded-none px-0 focus-visible:ring-0"
                          />

                          {/* Descripción editable */}
                          <textarea
                            value={ot.description}
                            onChange={e => handleCampo(ot._id, 'description', e.target.value)}
                            rows={2}
                            className="w-full text-xs text-muted-foreground bg-transparent border-0 resize-none focus:outline-none leading-relaxed"
                          />

                          {/* Meta chips */}
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Prioridad */}
                            <select
                              value={ot.priority}
                              onChange={e => handleCampo(ot._id, 'priority', e.target.value)}
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-transparent cursor-pointer ${pCfg.cls}`}
                            >
                              <option value="urgente">🔴 Urgente</option>
                              <option value="alta">🟠 Alta</option>
                              <option value="media">🟡 Media</option>
                              <option value="baja">🟢 Baja</option>
                            </select>

                            {/* Tipo */}
                            <select
                              value={ot.type}
                              onChange={e => handleCampo(ot._id, 'type', e.target.value)}
                              className="text-[11px] px-2 py-0.5 rounded-full border border-border bg-transparent text-muted-foreground cursor-pointer"
                            >
                              <option value="mantenimiento_correctivo">Correctivo</option>
                              <option value="mantenimiento_preventivo">Preventivo</option>
                              <option value="reparacion">Reparación</option>
                              <option value="inspeccion">Inspección</option>
                            </select>

                            {/* Ubicación */}
                            <Input
                              value={ot.location}
                              onChange={e => handleCampo(ot._id, 'location', e.target.value)}
                              placeholder="Ubicación..."
                              className="h-6 text-[11px] px-2 py-0 rounded-full border-border w-40"
                            />
                          </div>
                        </div>

                        {/* Eliminar */}
                        <button
                          onClick={() => handleEliminar(ot._id)}
                          className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {seleccionadas.size > 0 && (
                <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border -mx-5 px-5 py-3 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Se crearán <strong className="text-foreground">{seleccionadas.size}</strong> órdenes de trabajo en estado <em>Pendiente</em>
                  </p>
                  <Button onClick={handleCrear} className="gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Crear {seleccionadas.size} OT{seleccionadas.size !== 1 ? 's' : ''}
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Estado: creando */}
          {paso === 'creando' && (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="font-semibold">Creando órdenes de trabajo...</p>
            </div>
          )}

          {/* Estado: listo */}
          {paso === 'listo' && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <Check className="h-8 w-8 text-emerald-400" />
              </div>
              <div>
                <p className="font-bold text-lg text-emerald-400">¡{creadas} OT{creadas !== 1 ? 's' : ''} creada{creadas !== 1 ? 's' : ''}!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Las órdenes de trabajo ya están disponibles en el módulo de OTs en estado <strong>Pendiente</strong>.
                </p>
              </div>
              <Button variant="outline" onClick={handleCerrar} className="mt-2">
                Cerrar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}