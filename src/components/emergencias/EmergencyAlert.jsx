import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TIPO_LABELS = {
  incendio: '🔥 Incendio',
  inundacion: '💧 Inundación',
  corte_electrico: '⚡ Corte eléctrico',
  derrumbe: '🏚️ Derrumbe',
  rotura_gas: '💨 Rotura de gas',
  vandalismo: '🔨 Vandalismo',
  accidente: '🚑 Accidente',
  otro: '⚠️ Otro',
};

export default function EmergencyAlert({ emergencia, onClose, onView }) {
  // Auto-cerrar después de 15 segundos (solo cuando hay emergencia activa)
  useEffect(() => {
    if (!emergencia) return;
    const timer = setTimeout(onClose, 15000);
    return () => clearTimeout(timer);
  }, [emergencia, onClose]);

  return (
    <AnimatePresence>
      {emergencia && <div className="fixed inset-0 z-[9999] pointer-events-none">
        {/* Flash rojo en los bordes de la pantalla */}
        <motion.div
          className="absolute inset-0 border-4 border-red-500 rounded-none pointer-events-none"
          animate={{ opacity: [0, 1, 0, 1, 0, 1, 0] }}
          transition={{ duration: 2.5, times: [0, 0.1, 0.25, 0.4, 0.55, 0.7, 1] }}
        />

        {/* Overlay tenue pulsante */}
        <motion.div
          className="absolute inset-0 bg-red-600/10 pointer-events-none"
          animate={{ opacity: [0, 0.4, 0, 0.4, 0] }}
          transition={{ duration: 2, repeat: 2 }}
        />

        {/* Panel de alerta */}
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="absolute top-4 right-4 w-[340px] max-w-[calc(100vw-2rem)] pointer-events-auto"
        >
          <div
            className="rounded-2xl border border-red-500/60 shadow-2xl overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #1a0a0a 0%, #2d0f0f 100%)', boxShadow: '0 0 40px rgba(239,68,68,0.4)' }}
          >
            {/* Header pulsante */}
            <motion.div
              className="flex items-center gap-3 px-4 py-3 border-b border-red-500/30"
              animate={{ backgroundColor: ['rgba(239,68,68,0.15)', 'rgba(239,68,68,0.35)', 'rgba(239,68,68,0.15)'] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              >
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </motion.div>
              <div className="flex-1">
                <p className="text-xs font-bold text-red-300 uppercase tracking-widest">🚨 EMERGENCIA ACTIVA</p>
                <p className="text-[10px] text-red-400/70">Alerta para gerencia</p>
              </div>
              <button
                onClick={onClose}
                className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-red-500/20 transition-colors text-red-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>

            {/* Contenido */}
            <div className="px-4 py-3 space-y-2">
              <div>
                <p className="text-white font-bold text-sm leading-tight">
                  {emergencia.titulo || 'Nueva emergencia reportada'}
                </p>
                {emergencia.tipo && (
                  <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                    {TIPO_LABELS[emergencia.tipo] || emergencia.tipo}
                  </span>
                )}
              </div>

              {emergencia.establecimiento && (
                <p className="text-xs text-slate-300 flex items-center gap-1.5">
                  <span className="text-slate-500">📍</span>
                  {emergencia.establecimiento}
                </p>
              )}

              {emergencia.descripcion && (
                <p className="text-xs text-slate-400 line-clamp-2">{emergencia.descripcion}</p>
              )}
            </div>

            {/* Acción */}
            <div className="px-4 pb-4">
              <Button
                onClick={onView}
                size="sm"
                className="w-full gap-2 bg-red-600 hover:bg-red-500 text-white border-0"
              >
                Ver emergencia <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Barra de progreso (cuenta regresiva 15s) */}
            <motion.div
              className="h-1 bg-red-500"
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 15, ease: 'linear' }}
            />
          </div>
        </motion.div>
      </div>}
    </AnimatePresence>
  );
}