import React from 'react';
import { Building2, CheckCircle2, Loader2, Wrench, PlusCircle, ArrowRightLeft, PowerOff, DollarSign } from 'lucide-react';

const typeLabels = {
  equipo_electrico: 'Equipo eléctrico', equipo_mecanico: 'Equipo mecánico', instalacion_hvac: 'Climatización (HVAC)',
  instalacion_sanitaria: 'Instalación sanitaria', estructura: 'Estructura', vehiculo: 'Vehículo',
  herramienta: 'Herramienta', sistemas_informaticos: 'Sistemas informáticos', mobiliario: 'Mobiliario',
  seguridad: 'Seguridad', otro: 'Otro',
};
const statusLabels = {
  operativo: 'Operativo', en_mantenimiento: 'En mantenimiento', fuera_de_servicio: 'Fuera de servicio', baja: 'Baja',
};
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
const eventIcons = { creado: PlusCircle, mantenimiento: Wrench, cambio_estado: ArrowRightLeft, baja: PowerOff, movimiento: ArrowRightLeft, costo: DollarSign };
const eventColors = {
  creado: 'text-emerald-600 bg-emerald-50', mantenimiento: 'text-blue-600 bg-blue-50',
  cambio_estado: 'text-amber-600 bg-amber-50', baja: 'text-red-600 bg-red-50',
  movimiento: 'text-slate-600 bg-slate-50', costo: 'text-emerald-600 bg-emerald-50',
};

// Tarjeta de activo para la revisión BAPRO — datos del activo + modificaciones del mes.
export default function AssetCardRevision({ asset, onMarcar, marking }) {
  const mods = Array.isArray(asset.modificaciones) ? asset.modificaciones : [];
  return (
    <div className={`bg-white rounded-xl border p-4 transition-colors ${asset.visto_bapro ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-800">{asset.name}</span>
            {asset.code && <span className="text-[11px] text-slate-400 font-mono">{asset.code}</span>}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-slate-500">
            {asset.sede && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{asset.sede}</span>}
            {asset.area && <span>· {asset.area}</span>}
            <span>· {typeLabels[asset.type] || asset.type}</span>
            <span>· {statusLabels[asset.status] || asset.status}</span>
            {asset.brand && <span>· {asset.brand} {asset.model}</span>}
          </div>
          {asset.visto_bapro && asset.visto_bapro_fecha && (
            <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Visto el {new Date(asset.visto_bapro_fecha).toLocaleString('es-AR')}
            </p>
          )}
        </div>
        <div className="flex-shrink-0">
          {asset.visto_bapro ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-medium">
              <CheckCircle2 className="h-4 w-4" /> Visto
            </span>
          ) : (
            <button onClick={() => onMarcar(asset.id)} disabled={marking}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1.5 transition-colors">
              {marking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Marcar visto
            </button>
          )}
        </div>
      </div>

      {/* Modificaciones del mes */}
      <div className="mt-3 pt-3 border-t border-slate-100">
        <p className="text-[11px] text-slate-400 font-medium mb-2">Modificaciones del mes</p>
        {mods.length === 0 ? (
          <p className="text-[11px] text-slate-400">Sin modificaciones en el período.</p>
        ) : (
          <div className="relative pl-5 space-y-2.5">
            <div className="absolute left-1.5 top-1 bottom-1 w-px bg-slate-200" />
            {mods.map((m, i) => {
              const Icon = eventIcons[m.tipo_evento] || ArrowRightLeft;
              const color = eventColors[m.tipo_evento] || eventColors.cambio_estado;
              return (
                <div key={i} className="relative">
                  <div className={`absolute -left-[14px] h-4 w-4 rounded-full flex items-center justify-center ${color}`}>
                    <Icon className="h-2.5 w-2.5" />
                  </div>
                  <div className="ml-1.5">
                    <div className="text-[11px] font-medium text-slate-700 capitalize">{(m.tipo_evento || '').replace('_', ' ')}</div>
                    <div className="text-[11px] text-slate-500">{m.descripcion || '—'}</div>
                    <div className="text-[10px] text-slate-400">
                      {new Date(m.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                      {m.ot_id ? ' · OT' : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* OTs del mes vinculadas al activo */}
        {Array.isArray(asset.ots) && asset.ots.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-[11px] text-slate-400 font-medium mb-2 flex items-center gap-1"><Wrench className="h-3 w-3" /> Órdenes de trabajo del mes ({asset.ots.length})</p>
            <div className="space-y-1">
              {asset.ots.map((o, i) => (
                <div key={i} className="text-[11px] text-slate-600 flex items-center gap-2 flex-wrap">
                  <span className={`px-1.5 py-0.5 rounded font-medium ${otStatusStyles[o.status] || 'bg-slate-100 text-slate-600'}`}>{otStatusLabels[o.status] || o.status}</span>
                  <span className="font-medium text-slate-700">{o.title}</span>
                  {o.completed_date && <span className="text-slate-400">· {new Date(o.completed_date).toLocaleDateString('es-AR')}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}