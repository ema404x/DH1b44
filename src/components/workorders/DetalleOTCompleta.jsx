import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import WorkOrderDetailPanel from './WorkOrderDetailPanel';

// Órdenes rápidas (beta): la lista solo trae campos de tablero, así que el
// detalle NUNCA se abre con ese objeto. Primero se pide la OT completa por id
// (misma regla de visibilidad del tablero) y recién entonces se monta el panel.
// Si no se puede cargar, el panel no se abre.
export default function DetalleOTCompleta({ orderId, onClose, onDelete }) {
  const { data: order, isError, error } = useQuery({
    queryKey: ['workorder-completa', orderId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getWorkOrdersBoard', { id: orderId });
      if (!res.data?.order) throw new Error(res.data?.error || 'No se pudo cargar la orden.');
      return res.data.order;
    },
    staleTime: 0,
    gcTime: 0,
    retry: 1,
  });

  useEffect(() => {
    if (!isError) return;
    toast.error(error?.response?.data?.error || error?.message || 'No se pudo cargar la orden.');
    onClose();
  }, [isError]);

  if (!order) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-4 text-sm text-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Cargando orden…
        </div>
      </div>
    );
  }

  return <WorkOrderDetailPanel order={order} onClose={onClose} onDelete={onDelete} />;
}