import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Send, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useOfflineMode } from '@/hooks/useOfflineMode';
import { enviarPropuestaOT } from '@/lib/propuestasOT';
import PasosIndicador from '@/components/proponer-ot/PasosIndicador';
import PasoDonde from '@/components/proponer-ot/PasoDonde';
import PasoQue from '@/components/proponer-ot/PasoQue';
import PasoFotos from '@/components/proponer-ot/PasoFotos';
import PasoUrgencia from '@/components/proponer-ot/PasoUrgencia';
import PasoRevisar from '@/components/proponer-ot/PasoRevisar';
import ConfirmacionOperario from '@/components/operario-home/ConfirmacionOperario';

const TITULOS = ['¿Dónde es?', '¿Qué pasa?', 'Sacá fotos', '¿Qué tan urgente es?', 'Revisá y enviá'];
const VACIO = { lugar: null, titulo: '', descripcion: '', fotos: [], prioridad: 'media' };

/** Proponer OT (Modo operario): 5 pasos y envío con o sin conexión. */
export default function ProponerOT() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const offlineMode = useOfflineMode();
  const [paso, setPaso] = useState(1);
  const [datos, setDatos] = useState(VACIO);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const set = (patch) => setDatos((d) => ({ ...d, ...patch }));
  const offline = offlineMode || !navigator.onLine;

  const puedeSeguir = paso === 1 ? !!datos.lugar?.nombre?.trim() : paso === 2 ? !!datos.titulo.trim() : true;

  const enviar = async () => {
    setEnviando(true);
    try {
      const l = datos.lugar;
      const res = await enviarPropuestaOT({
        titulo: datos.titulo.trim(),
        descripcion: datos.descripcion.trim(),
        prioridad: datos.prioridad,
        tipo: 'mantenimiento_correctivo',
        asset_id: l.tipo === 'asset' ? l.id : undefined,
        location_qr_id: l.tipo === 'loc' ? l.id : undefined,
        location: l.tipo === 'texto' ? l.nombre.trim() : undefined,
      }, datos.fotos.map(({ blob, name }) => ({ blob, name })), { offline });
      qc.invalidateQueries({ queryKey: ['mis-propuestas-ot'] });
      setResultado(res);
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || 'No se pudo enviar la propuesta');
    } finally {
      setEnviando(false);
    }
  };

  if (resultado) {
    const titulo = resultado._offline ? 'Propuesta guardada' : resultado.jefe_sitio ? `Propuesta enviada a ${resultado.jefe_sitio}` : 'Propuesta enviada';
    const detalle = resultado._offline ? 'Se enviará a tu jefe cuando vuelva la señal' : resultado.jefe_sitio ? 'Te avisamos cuando la revise' : 'La revisará la gerencia de tu sector';
    return (
      <ConfirmacionOperario
        titulo={titulo}
        detalle={detalle}
        acciones={(<>
          <button onClick={() => navigate('/operario')} className="h-14 w-full rounded-xl bg-primary text-lg font-bold text-primary-foreground active:scale-[0.98]">Volver al inicio</button>
          <button onClick={() => { setDatos(VACIO); setPaso(1); setResultado(null); }} className="h-12 w-full rounded-xl border border-border bg-card text-base font-semibold text-card-foreground">Proponer otra</button>
        </>)}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 page-enter">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/operario')} aria-label="Cancelar" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card active:bg-accent">
          <X className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-foreground">Proponer OT</h1>
      </div>
      <PasosIndicador paso={paso} />

      <AnimatePresence mode="wait">
        <motion.div key={paso} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }} className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">{TITULOS[paso - 1]}</h2>
          {paso === 1 && <PasoDonde lugar={datos.lugar} onChange={(lugar) => set({ lugar })} />}
          {paso === 2 && <PasoQue titulo={datos.titulo} descripcion={datos.descripcion} onChange={set} />}
          {paso === 3 && <PasoFotos fotos={datos.fotos} onChange={(fotos) => set({ fotos })} />}
          {paso === 4 && <PasoUrgencia prioridad={datos.prioridad} onChange={(prioridad) => set({ prioridad })} />}
          {paso === 5 && <PasoRevisar datos={datos} irA={setPaso} offline={offline} />}
        </motion.div>
      </AnimatePresence>

      <div className="grid grid-cols-[auto_1fr] gap-3">
        <button onClick={() => setPaso((p) => p - 1)} disabled={paso === 1 || enviando} aria-label="Atrás" className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-card disabled:opacity-40">
          <ArrowLeft className="h-5 w-5" />
        </button>
        {paso < 5 ? (
          <button onClick={() => setPaso((p) => p + 1)} disabled={!puedeSeguir} className="flex h-14 items-center justify-center gap-2 rounded-xl bg-primary text-lg font-bold text-primary-foreground active:scale-[0.98] disabled:opacity-40">
            Siguiente <ArrowRight className="h-5 w-5" />
          </button>
        ) : (
          <button onClick={enviar} disabled={enviando} className="flex h-14 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-lg font-bold text-white active:scale-[0.98] disabled:opacity-60">
            {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />} Enviar propuesta
          </button>
        )}
      </div>
    </div>
  );
}