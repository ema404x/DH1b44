import React from 'react';
import { Wrench, Calendar, MapPin } from 'lucide-react';

const otStatusLabels = {
  pendiente: 'Pendiente', asignada: 'Asignada', en_progreso: 'En progreso', obra: 'En obra',
  pendiente_validacion: 'P. validación', completada: 'Completada', cancelada: 'Cancelada',
};
const otStatusStyles = {
  pendiente: 'bg-slate-100 text-slate-600', asignada: 'bg-blue-100 text-blue-700',
  en_progreso: 'bg-amber-100 text-amber-700', obra: 'bg-amber-100 text-amber-700',
  pendiente_validacion: 'bg-violet-100 text-violet-700', completada: 'bg-emerald-100 text-emerald-700',
  cancelada: 'bg-red-100 text-red-700',
};
const typeOtLabels = {
  mantenimiento_preventivo: 'Mant. preventivo', mantenimiento_correctivo: 'Mant. correctivo',
  instalacion: 'Instalación', inspeccion: 'Inspección', reparacion: 'Reparación', emergencia: 'Emergencia',
};
const priorityLabels = { urgente: 'Urgente', alta: 'Alta', media: 'Media', baja: 'Baja' };
const priorityStyles = {
  urgente: 'bg-red-100 text-red-700', alta: 'bg-orange-100 text-orange-700',
  media: 'bg-slate-100 text-slate-600', baja: 'bg-slate-50 text-slate-500',
};

// Listado plano de OTs generadas en el mes del lote BAPRO.
export default function OTsMesList({ ots }) {
  if (!ots || ots.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
        <Wrench className="h-8 w-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">No se generaron órdenes de trabajo en este mes.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {ots.map(o => (
        <div key={o.id} className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${otStatusStyles[o.status] || 'bg-slate-100 text-slate-600'}`}>
                {otStatusLabels[o.status] || o.status}
              </span>
              {o.priority && (
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-medium ${priorityStyles[o.priority] || priorityStyles.media}`}>
                  {priorityLabels[o.priority] || o.priority}
                </span>
              )}
              <span className="text-[11px] text-slate-400">{typeOtLabels[o.type] || o.type}</span>
            </div>
            {o.created_date && (
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Calendar className="h-3 w-3" />{new Date(o.created_date).toLocaleDateString('es-AR')}
              </span>
            )}
          </div>
          <h4 className="text-sm font-semibold text-slate-800 mt-1.5">{o.title}</h4>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 flex-wrap">
            {o.asset_name && <span className="flex items-center gap-1"><Wrench className="h-3 w-3" />{o.asset_name}</span>}
            {o.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{o.location}</span>}
            {o.completed_date && <span>· Completada {new Date(o.completed_date).toLocaleDateString('es-AR')}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}