import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PropuestaInfo from './PropuestaInfo';
import PropuestaCampos from './PropuestaCampos';
import PropuestaFotos from './PropuestaFotos';
import PropuestaHistorial from './PropuestaHistorial';
import PropuestaAcciones from './PropuestaAcciones';
import ResponsableSelect, { SIN_ASIGNAR } from './ResponsableSelect';
import { resolverPropuesta } from '@/lib/propuestasOT';

const FIELDS = ['titulo', 'descripcion', 'prioridad', 'tipo', 'fecha_sugerida', 'fotos'];
const toForm = (p) => ({
  titulo: p?.titulo || '', descripcion: p?.descripcion || '', prioridad: p?.prioridad || 'media',
  tipo: p?.tipo || 'mantenimiento_correctivo', fecha_sugerida: p?.fecha_sugerida || '', fotos: p?.fotos || [],
});

export default function PropuestaDetalleDialog({ propuesta, open, onOpenChange, onUpdated }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(toForm(propuesta));
  const [responsable, setResponsable] = useState(propuesta?.solicitante_user_id || SIN_ASIGNAR);
  useEffect(() => { setForm(toForm(propuesta)); }, [propuesta]);
  useEffect(() => { setResponsable(propuesta?.solicitante_user_id || SIN_ASIGNAR); }, [propuesta?.id]);

  const camposRef = useRef(null);
  const irACampos = () => {
    camposRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    camposRef.current?.querySelector('input, textarea')?.focus({ preventScroll: true });
  };
  const editable = propuesta?.estado === 'enviada';
  const base = toForm(propuesta);
  const dirty = editable && FIELDS.some((k) => JSON.stringify(form[k]) !== JSON.stringify(base[k]));

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['propuestas-ot'] });
    qc.invalidateQueries({ queryKey: ['propuestas-ot-contar'] });
  };
  const guardar = async () => {
    const res = await resolverPropuesta({ action: 'editar', id: propuesta.id, cambios: form });
    return res.solicitud;
  };

  const mutation = useMutation({
    mutationFn: async ({ accion, motivo }) => {
      if (accion === 'guardar') return { accion, solicitud: await guardar() };
      if (accion === 'aprobar' && dirty) await guardar();
      const res = await resolverPropuesta({
        action: accion,
        id: propuesta.id,
        motivo,
        ...(accion === 'aprobar' ? { responsable_user_id: responsable === SIN_ASIGNAR ? '' : responsable } : {}),
      });
      return { accion, solicitud: res.solicitud };
    },
    onSuccess: ({ accion, solicitud }) => {
      refrescar();
      if (accion === 'guardar') { toast.success('Cambios guardados'); onUpdated?.(solicitud); return; }
      if (accion === 'aprobar') {
        ['workorders', 'workorders-board', 'workorders-campo'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
        toast.success('Propuesta aprobada: se creó la OT');
      } else {
        toast.success('Propuesta rechazada');
      }
      onOpenChange(false);
    },
    onError: (err) => toast.error(err?.response?.data?.error || err?.message || 'No se pudo completar la acción'),
  });

  if (!propuesta) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 flex flex-col max-h-[90vh] max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:rounded-none">
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
        <DialogHeader>
          <DialogTitle className="text-base leading-snug pr-6 text-left">{propuesta.titulo}</DialogTitle>
        </DialogHeader>
          <PropuestaInfo propuesta={propuesta} />
          <div ref={camposRef} className="scroll-mt-4">
            <PropuestaCampos form={form} onChange={setForm} disabled={!editable || mutation.isPending} />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fotos</p>
            <PropuestaFotos
              fotos={form.fotos}
              onRemove={editable ? (url) => setForm((f) => ({ ...f, fotos: f.fotos.filter((u) => u !== url) })) : undefined}
            />
          </div>
          {editable && (
            <ResponsableSelect
              value={responsable}
              onChange={setResponsable}
              solicitante={{ user_id: propuesta.solicitante_user_id, nombre: propuesta.solicitante_nombre }}
              disabled={mutation.isPending}
            />
          )}
          <PropuestaHistorial historial={propuesta.historial} />
        </div>
        {editable && (
          <div className="border-t border-border bg-background px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:rounded-b-lg">
            <PropuestaAcciones
              dirty={dirty}
              busy={mutation.isPending}
              onEditar={irACampos}
              onGuardar={() => mutation.mutate({ accion: 'guardar' })}
              onAprobar={() => mutation.mutate({ accion: 'aprobar' })}
              onRechazar={(motivo) => mutation.mutate({ accion: 'rechazar', motivo })}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}