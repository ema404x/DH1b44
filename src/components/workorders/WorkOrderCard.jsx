import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, MapPin, Wrench, User, CheckCircle2 } from 'lucide-react';
import WorkOrderQRButton from './WorkOrderQRButton';
import { useResolveCreator } from '@/hooks/useResolveCreator';
import { esOtVencida } from '@/lib/otVencimiento';

// Fila de OT extraída a su propio archivo y memoizada a nivel atómico.
// React.memo evita re-renderizar todas las cards cuando el padre re-renderiza
// por cambios NO relacionados con el order (ej: escribir en el buscador, abrir
// el panel de detalle, cambiar de tab) — siempre que las props sean estables.
// Las callbacks onOpen/onShowQR/onComplete/onStart deben venir estabilizadas con
// useCallback desde el padre para que la memo sea efectiva.
// NO se envuelve a nivel página (dead-end: rompe el build) — sólo a nivel fila.

const STATUS_LABELS = {
  pendiente: 'Pendiente',
  asignada: 'Asignada',
  en_progreso: 'En Progreso',
  obra: 'Obra',
  pendiente_validacion: 'Validación',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

function WorkOrderCard({ order, onOpen, onShowQR, onComplete, onStart, canComplete }) {
  const { resolveOTOwner } = useResolveCreator();
  const isOverdue = esOtVencida(order);
  const { name: creadorPor, label: creadorLabel } = resolveOTOwner(order);
  const isTerminal = ['completada', 'cancelada'].includes(order.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur border rounded-lg p-4 cursor-pointer transition-all hover:-translate-y-1 ${isOverdue ? 'border-red-500/30 bg-red-500/5' : 'border-slate-700/50'}`}
      onClick={() => onOpen(order)}
    >
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
        <WorkOrderQRButton order={order} onShowQR={onShowQR} />
      </div>

      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center flex-shrink-0">
          <Wrench className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white">{order.title}</h3>
          <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-slate-400">
            {order.asset_name && <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{order.asset_name}</span>}
            {order.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{order.location}</span>}
            {order.assigned_name && <span className="flex items-center gap-1"><User className="h-3 w-3" />{order.assigned_name}</span>}
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
            <User className="h-2.5 w-2.5" /> {creadorLabel} {creadorPor}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700/50">
        <Badge className="text-xs bg-slate-700 text-slate-200">{STATUS_LABELS[order.status] || order.status}</Badge>
        <Badge variant="secondary" className="text-xs">{order.priority}</Badge>
        {isOverdue && <Badge className="bg-red-500/20 text-red-300 text-xs">VENCIDA</Badge>}
        {canComplete && !isTerminal && ['pendiente', 'asignada'].includes(order.status) && (
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); onStart(order.id); }}
            className="ml-auto h-7 px-3 text-xs gap-1 bg-blue-600 hover:bg-blue-500 text-white"
          >
            <Zap className="h-3.5 w-3.5" /> Iniciar
          </Button>
        )}
        {canComplete && !isTerminal && !['pendiente', 'asignada'].includes(order.status) && (
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); onComplete(order.id); }}
            className="ml-auto h-7 px-3 text-xs gap-1 bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Completar
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// Comparación por props: el order y las callbacks son los únicos inputs.
// React.memo shallow-compara; con callbacks estables (useCallback) del padre,
// las cards no se re-renderizan al escribir en el buscador o abrir el detalle.
export default React.memo(WorkOrderCard);