import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Bug, X, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const BUG_EMAIL = 'EMA404X@HOTMAIL.COM';

const TIPOS = [
  { value: 'visual',       label: 'Error visual / diseño' },
  { value: 'funcional',    label: 'Función que no anda' },
  { value: 'datos',        label: 'Datos incorrectos / pérdida' },
  { value: 'rendimiento', label: 'Lentitud / cuelgue' },
  { value: 'otro',         label: 'Otro' },
];

export default function BugReportBubble() {
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState('funcional');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState(null);
  const [hidden, setHidden] = useState(false);

  const reset = () => {
    setTipo('funcional');
    setTitulo('');
    setDescripcion('');
    setEnviado(false);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!titulo.trim() || !descripcion.trim()) return;
    setEnviando(true);
    setError(null);
    try {
      const nombre = user?.full_name || user?.email || 'Usuario anónimo';
      const emailUser = user?.email || 'sin email';
      const pagina = window.location.pathname;
      const fecha = new Date().toLocaleString('es-AR', { timeZone: 'America/Buenos_Aires' });

      const body = [
        `🛠️ NUEVO REPORTE DE BUG / ERROR`,
        ``,
        `Reportado por: ${nombre} (${emailUser})`,
        `Página: ${pagina}`,
        `Fecha: ${fecha}`,
        `Tipo: ${TIPOS.find(t => t.value === tipo)?.label || tipo}`,
        ``,
        `── Título ──`,
        titulo.trim(),
        ``,
        `── Descripción ──`,
        descripcion.trim(),
        ``,
        `── Contexto técnico ──`,
        `User-Agent: ${navigator.userAgent}`,
        `Resolución: ${window.screen.width}x${window.screen.height}`,
      ].join('\n');

      await base44.integrations.Core.SendEmail({
        to: BUG_EMAIL,
        subject: `[BUG] ${titulo.trim()}`,
        body,
        from_name: 'Reporte DH1',
      });

      setEnviado(true);
      setTimeout(() => { setOpen(false); reset(); }, 2500);
    } catch (err) {
      setError(err?.message || 'No se pudo enviar el reporte. Intentá de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      {/* Burbuja flotante */}
      <AnimatePresence>
        {!open && !hidden && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-20 lg:bottom-6 left-4 z-40 group"
          >
            <button onClick={() => setHidden(true)} title="Ocultar"
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-slate-700 border border-border text-muted-foreground hover:text-white hover:bg-slate-600 flex items-center justify-center z-10 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
              <X className="h-3 w-3" />
            </button>
            <button
              onClick={() => setOpen(true)}
              className="h-12 w-12 rounded-full bg-amber-500 text-white shadow-xl flex items-center justify-center relative"
              style={{ boxShadow: '0 4px 20px rgba(245,158,11,0.5)' }}
              title="Reportar un bug o error"
            >
              <Bug className="h-5 w-5" />
              <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-amber-500 animate-pulse" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de reporte */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => !enviando && setOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3"
                style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                    <Bug className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-white">Reportar bug o error</p>
                    <p className="text-[10px] text-white/80">Llega directo al equipo de desarrollo</p>
                  </div>
                </div>
                <button onClick={() => !enviando && setOpen(false)}
                  className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors text-white/80 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              {enviado ? (
                <div className="flex flex-col items-center justify-center py-10 px-6 text-center gap-3">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                  <div>
                    <p className="font-semibold text-foreground">¡Reporte enviado!</p>
                    <p className="text-xs text-muted-foreground mt-1">Gracias por ayudarnos a mejorar la plataforma.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Tipo de problema</label>
                    <select
                      value={tipo}
                      onChange={(e) => setTipo(e.target.value)}
                      disabled={enviando}
                      className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Título corto *</label>
                    <input
                      type="text"
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      disabled={enviando}
                      placeholder="Ej: No puedo aprobar un certificado"
                      maxLength={120}
                      className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Descripción del error *</label>
                    <textarea
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      disabled={enviando}
                      placeholder="Contá qué pasó, qué esperabas que ocurriera y qué hiciste cuando ocurrió el error..."
                      rows={4}
                      maxLength={2000}
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                    />
                    <p className="text-[10px] text-muted-foreground text-right">{descripcion.length}/2000</p>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button type="submit" disabled={enviando || !titulo.trim() || !descripcion.trim()} size="sm" className="gap-1.5 bg-amber-500 hover:bg-amber-600">
                      {enviando ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando...</> : <><Send className="h-3.5 w-3.5" /> Enviar reporte</>}
                    </Button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}