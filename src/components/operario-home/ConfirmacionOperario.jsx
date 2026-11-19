import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import BodyPortal from '@/components/operario/BodyPortal';

/** Pantalla de confirmación a pantalla completa con un ✓ verde grande. */
export default function ConfirmacionOperario({ titulo, detalle, acciones }) {
  return (
    <BodyPortal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-6 bg-background px-6 text-center"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="flex h-28 w-28 items-center justify-center rounded-full bg-emerald-500 shadow-2xl shadow-emerald-500/30"
        >
          <Check className="h-16 w-16 text-white" strokeWidth={3} />
        </motion.div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">{titulo}</h2>
          {detalle && <p className="mt-2 text-base text-muted-foreground">{detalle}</p>}
        </div>
        <div className="flex w-full max-w-sm flex-col gap-3">{acciones}</div>
      </motion.div>
    </BodyPortal>
  );
}