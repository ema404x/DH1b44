import React, { useEffect, useState } from 'react';
import { Monitor, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { isMobileOptimized, DESKTOP_ONLY_META } from '@/lib/mobileModuleConfig';

/**
 * Gate que envuelve módulos desktop-only.
 *
 * - En desktop (lg+): renderiza los children directamente.
 * - En mobile: muestra un aviso "Optimizado para escritorio" con descripción
 *   y un botón "Continuar igual" que abre el módulo sin promoción visual.
 *   Preserva el acceso vía URL directa — nunca bloquea, solo guía.
 *
 * La decisión desktop/mobile se toma por matchMedia (min-width: 1024px) y se
 * actualiza si el usuario redimensiona la ventana.
 */
export default function DesktopOnlyGate({ path, moduleLabel, description, children }) {
  const [isDesktop, setIsDesktop] = useState(true);
  const [forceShow, setForceShow] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const update = () => {
      setIsDesktop(mql.matches);
      // Reset al cambiar de mobile↔desktop para que vuelva a mostrar el aviso.
      setForceShow(false);
    };
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  // Si la ruta resulta ser mobile-optimized (ej: control-riesgo marcado true),
  // no mostrar el gate — renderizar directo.
  if (isMobileOptimized(path)) return children;

  // Desktop o usuario que forzó "Continuar igual" → render normal.
  if (isDesktop || forceShow) return children;

  const meta = DESKTOP_ONLY_META[path] || {};
  const label = moduleLabel || meta.label || 'Este módulo';
  const desc = description || meta.description ||
    'Este módulo está optimizado para escritorio. Para la mejor experiencia, usá una pantalla amplia.';

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="max-w-sm w-full text-center space-y-5"
      >
        <div className="flex justify-center">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
            <Monitor className="h-9 w-9 text-primary" />
            <div className="absolute -inset-1 rounded-2xl bg-primary/5 blur-xl -z-10" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Optimizado para escritorio</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">{label}</span> — {desc}
          </p>
        </div>
        <button
          onClick={() => setForceShow(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors min-h-[44px]"
        >
          Continuar igual
          <ArrowRight className="h-4 w-4" />
        </button>
      </motion.div>
    </div>
  );
}