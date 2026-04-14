import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquarePlus, User, ArrowRight, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

const estadoColors = {
  pendiente:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  asignado:    'bg-blue-100 text-blue-700 border-blue-200',
  en_progreso: 'bg-purple-100 text-purple-700 border-purple-200',
  resuelto:    'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelado:   'bg-gray-100 text-gray-500 border-gray-200',
};

const estadoLabels = {
  pendiente: 'Pendiente', asignado: 'Asignado',
  en_progreso: 'En progreso', resuelto: 'Resuelto', cancelado: 'Cancelado',
};

export default function PendienteHistorial({ pendienteId }) {
  const [comentario, setComentario] = useState('');
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();

  const { data: historial = [], isLoading } = useQuery({
    queryKey: ['pendiente-historial', pendienteId],
    queryFn: () => base44.entities.PendienteHistorial.filter(
      { pendiente_id: pendienteId },
      '-created_date'
    ),
    enabled: !!pendienteId,
  });

  const addNotaMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.PendienteHistorial.create({
        pendiente_id: pendienteId,
        usuario_email: user.email,
        usuario_nombre: user.full_name || user.email,
        comentario: comentario.trim(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pendiente-historial', pendienteId] });
      setComentario('');
      setShowForm(false);
      toast.success('Nota añadida');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando historial...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add note */}
      <div className="border rounded-lg overflow-hidden">
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:bg-muted/40 transition-colors"
          >
            <MessageSquarePlus className="h-4 w-4" />
            Añadir nota o comentario...
          </button>
        ) : (
          <div className="p-3 space-y-2">
            <Textarea
              autoFocus
              placeholder="Describe lo que ocurrió, decisiones tomadas, observaciones..."
              value={comentario}
              onChange={e => setComentario(e.target.value)}
              rows={3}
              className="text-sm"
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setComentario(''); }}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!comentario.trim() || addNotaMutation.isPending}
                onClick={() => addNotaMutation.mutate()}
              >
                {addNotaMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Guardar nota'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      {historial.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-20" />
          <p>Sin historial registrado todavía</p>
          <p className="text-xs mt-1">Los cambios de estado y notas aparecerán aquí</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-border" />

          <div className="space-y-3">
            {historial.map((h, idx) => {
              const isEstadoCambio = h.estado_anterior || h.estado_nuevo;
              const isJefeCambio = h.jefe_sitio_anterior || h.jefe_sitio_nuevo;
              const isSoloNota = !isEstadoCambio && !isJefeCambio;

              return (
                <div key={h.id} className="flex gap-3 pl-2">
                  {/* Icon dot */}
                  <div className={`relative z-10 flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center mt-1 ${
                    isSoloNota
                      ? 'bg-slate-200 text-slate-500'
                      : isEstadoCambio
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-amber-100 text-amber-600'
                  }`}>
                    {isSoloNota
                      ? <MessageSquarePlus className="h-2.5 w-2.5" />
                      : <ArrowRight className="h-2.5 w-2.5" />
                    }
                  </div>

                  {/* Content */}
                  <div className="flex-1 bg-card border rounded-lg px-3 py-2.5 min-w-0">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span>{h.usuario_nombre || h.usuario_email}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(h.created_date), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
                      </div>
                    </div>

                    {/* Estado change */}
                    {isEstadoCambio && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {h.estado_anterior && (
                          <Badge variant="outline" className={`text-[10px] border ${estadoColors[h.estado_anterior]}`}>
                            {estadoLabels[h.estado_anterior] || h.estado_anterior}
                          </Badge>
                        )}
                        <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        {h.estado_nuevo && (
                          <Badge variant="outline" className={`text-[10px] border ${estadoColors[h.estado_nuevo]}`}>
                            {estadoLabels[h.estado_nuevo] || h.estado_nuevo}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Jefe change */}
                    {isJefeCambio && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground flex-wrap">
                        <span>Jefe:</span>
                        <span className="line-through">{h.jefe_sitio_anterior || 'Sin asignar'}</span>
                        <ArrowRight className="h-3 w-3" />
                        <span className="font-medium text-foreground">{h.jefe_sitio_nuevo || 'Sin asignar'}</span>
                      </div>
                    )}

                    {/* Campos modificados */}
                    {h.campos_modificados?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {h.campos_modificados.map(c => (
                          <span key={c} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Comentario */}
                    {h.comentario && (
                      <p className="text-xs text-foreground mt-1.5 leading-relaxed border-t pt-1.5">
                        {h.comentario}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}