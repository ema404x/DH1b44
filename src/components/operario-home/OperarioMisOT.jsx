import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import OperarioOTCard from './OperarioOTCard';

const VACIO = {
  hacer: 'No tenés OT para hacer. ¡Buen trabajo!',
  curso: 'No tenés OT en curso.',
  enviadas: 'No hay OT esperando a tu jefe.',
};

/**
 * "Mis OT" del Inicio operario: pestañas Para hacer / En curso / Enviadas.
 * Solo presenta; las acciones son las de PortalOperarioApp (onIniciar / onFinalizar).
 */
export default function OperarioMisOT({ porIniciar, enProgreso, enValidacion, total, processing, pendingOtIds, onIniciar, onFinalizar }) {
  const [tab, setTab] = useState(enProgreso.length ? 'curso' : 'hacer');
  const tabs = [
    { key: 'hacer', label: 'Para hacer', list: porIniciar },
    { key: 'curso', label: 'En curso', list: enProgreso },
    { key: 'enviadas', label: 'Enviadas', list: enValidacion },
  ];
  const actual = tabs.find((t) => t.key === tab);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'min-h-[52px] rounded-xl border px-1 text-sm font-semibold leading-tight transition-colors',
              tab === t.key ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-card text-muted-foreground active:bg-accent'
            )}
          >
            {t.label} <span className="tabular-nums">({t.list.length})</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="flex flex-col gap-3">
          {actual.list.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-8 text-center">
              <Sparkles className="h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm font-medium text-muted-foreground">{VACIO[tab]}</p>
            </div>
          ) : actual.list.slice(0, 5).map((ot) => (
            <OperarioOTCard
              key={ot.id}
              ot={ot}
              processing={processing === ot.id}
              pendingSync={pendingOtIds.has(ot.id)}
              onIniciar={tab === 'hacer' ? () => onIniciar(ot) : undefined}
              onFinalizar={tab === 'curso' ? () => onFinalizar(ot) : undefined}
            />
          ))}
        </motion.div>
      </AnimatePresence>

      {total > 0 && (
        <Link to="/mis-ots" className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-base font-semibold text-card-foreground transition-colors active:bg-accent">
          Ver todas mis OT ({total}) <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </Link>
      )}
    </div>
  );
}