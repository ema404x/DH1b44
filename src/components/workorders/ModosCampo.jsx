import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, AlertTriangle, MapPin, User, ChevronRight, Smartphone } from 'lucide-react';
import { motion } from 'framer-motion';
import { format, parseISO, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

const priorityConfig = {
  urgente: { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-300', dot: 'bg-red-400' },
  alta: { bg: 'bg-orange-500/20', border: 'border-orange-500/40', text: 'text-orange-300', dot: 'bg-orange-400' },
  media: { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-300', dot: 'bg-blue-400' },
  baja: { bg: 'bg-slate-500/20', border: 'border-slate-500/40', text: 'text-slate-300', dot: 'bg-slate-400' },
};

export default function ModoCampo({ currentUser, onOpenOrder }) {
  const qc = useQueryClient();

  const { data: orders = [] } = useQuery({
    queryKey: ['workorders-campo'],
    queryFn: () => base44.entities.WorkOrder.filter({ assigned_name: currentUser?.full_name }),
    enabled: !!currentUser?.full_name,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.WorkOrder.update(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workorders-campo'] });
      qc.invalidateQueries({ queryKey: ['workorders'] });
      toast.success('Estado actualizado');
    },
  });

  const activas = orders.filter(o => !['completada', 'cancelada'].includes(o.status));
  const completadas = orders.filter(o => o.status === 'completada').slice(0, 5);

  const urgentes = activas.filter(o => o.priority === 'urgente').length;
  const vencidas = activas.filter(o => o.scheduled_date && isPast(parseISO(o.scheduled_date))).length;

  return (
    <div className="space-y-5">
      {/* Banner modo campo */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
        <Smartphone className="h-5 w-5 text-emerald-400 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-300">Modo Campo Activo</p>
          <p className="text-xs text-emerald-400/70">Mostrando mis OTs asignadas · {currentUser?.full_name}</p>
        </div>
      </div>

      {/* Stats rápidos */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card/50 p-3 text-center">
          <p className="text-2xl font-bold">{activas.length}</p>
          <p className="text-xs text-muted-foreground">Activas</p>
        </div>
        <div className={`rounded-xl border p-3 text-center ${urgentes > 0 ? 'border-red-500/40 bg-red-500/10' : 'border-border bg-card/50'}`}>
          <p className={`text-2xl font-bold ${urgentes > 0 ? 'text-red-400' : ''}`}>{urgentes}</p>
          <p className="text-xs text-muted-foreground">Urgentes</p>
        </div>
        <div className={`rounded-xl border p-3 text-center ${vencidas > 0 ? 'border-amber-500/40 bg-amber-500/10' : 'border-border bg-card/50'}`}>
          <p className={`text-2xl font-bold ${vencidas > 0 ? 'text-amber-400' : ''}`}>{vencidas}</p>
          <p className="text-xs text-muted-foreground">Vencidas</p>
        </div>
      </div>

      {/* Mis OTs activas */}
      <div>
        <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Mis órdenes activas</h3>
        {activas.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-500 opacity-50" />
            <p className="text-sm">¡Todo al día! Sin OTs pendientes.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activas
              .sort((a, b) => {
                const priority = { urgente: 0, alta: 1, media: 2, baja: 3 };
                return (priority[a.priority] || 2) - (priority[b.priority] || 2);
              })
              .map(order => {
                const cfg = priorityConfig[order.priority] || priorityConfig.media;
                const isOverdue = order.scheduled_date && isPast(parseISO(order.scheduled_date));
                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`rounded-xl border p-4 cursor-pointer hover:brightness-110 transition-all ${cfg.bg} ${cfg.border}`}
                    onClick={() => onOpenOrder(order)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                          <p className="text-sm font-semibold truncate">{order.title}</p>
                        </div>
                        <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                          {order.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{order.location}</span>}
                          {order.scheduled_date && (
                            <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-400 font-semibold' : ''}`}>
                              {isOverdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                              {format(parseISO(order.scheduled_date), "dd/MM", { locale: es })}
                              {isOverdue && ' ⚠ Vencida'}
                            </span>
                          )}
                        </div>
                        <Badge className="mt-2 text-[10px] bg-white/10 text-white/70">{order.status?.replace(/_/g, ' ')}</Badge>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        {order.status === 'pendiente' && (
                          <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
                            onClick={e => { e.stopPropagation(); updateMutation.mutate({ id: order.id, status: 'en_progreso' }); }}>
                            Iniciar
                          </Button>
                        )}
                        {order.status === 'en_progreso' && (
                          <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                            onClick={e => {
                              e.stopPropagation();
                              const pendingChecklist = (order.checklist || []).filter(t => !t.completed);
                              if (pendingChecklist.length > 0) {
                                toast.warning(`Faltan ${pendingChecklist.length} tarea(s) del checklist`);
                                onOpenOrder(order);
                                return;
                              }
                              if (order.require_photos && !(order.photos || []).length) {
                                toast.warning('Esta OT requiere al menos una foto');
                                onOpenOrder(order);
                                return;
                              }
                              updateMutation.mutate({ id: order.id, status: 'completada' });
                            }}>
                            Completar
                          </Button>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground self-center" />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
          </div>
        )}
      </div>

      {/* Últimas completadas */}
      {completadas.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Últimas completadas</h3>
          <div className="space-y-1.5">
            {completadas.map(o => (
              <div key={o.id} className="flex items-center gap-3 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <p className="text-sm flex-1 truncate">{o.title}</p>
                {o.completed_date && (
                  <p className="text-xs text-muted-foreground flex-shrink-0">
                    {format(parseISO(o.completed_date), "dd/MM", { locale: es })}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}