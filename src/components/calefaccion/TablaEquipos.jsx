import React from 'react';
import { Badge } from '@/components/ui/badge';

export default function TablaEquipos({ equipos, estadoConfig, tipoLabels }) {
  if (equipos.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm">
        Sin registros con los filtros seleccionados
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/60 border-b border-slate-700/50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Escuela</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Jefe Sitio</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Cmna</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Tipo</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Total</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">✓</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">✗</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">%</th>
              <th className="text-center px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Estado</th>
            </tr>
          </thead>
          <tbody>
            {equipos.map((e, idx) => {
              const cfg = estadoConfig[e.estado] || estadoConfig.normal;
              return (
                <tr key={e.id || idx} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-2.5 text-white text-xs font-medium max-w-[200px] truncate">{e.escuela}</td>
                  <td className="px-4 py-2.5 text-slate-300 text-xs max-w-[140px] truncate">{e.jefe_sitio || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-400 text-xs">{e.comuna}</td>
                  <td className="px-3 py-2.5 text-slate-300 text-xs">{tipoLabels[e.tipo_equipo] || e.tipo_equipo}</td>
                  <td className="px-3 py-2.5 text-white text-xs text-right font-semibold">{Math.round(e.cantidad_total)}</td>
                  <td className="px-3 py-2.5 text-emerald-400 text-xs text-right">{Math.round(e.cantidad_funciona)}</td>
                  <td className="px-3 py-2.5 text-red-400 text-xs text-right">{Math.round(e.cantidad_total) - Math.round(e.cantidad_funciona)}</td>
                  <td className="px-3 py-2.5 text-xs text-right">
                    <span className={cfg.color + ' font-bold'}>{Math.round(e.cantidad_total) > 0 ? Math.round((Math.round(e.cantidad_funciona) / Math.round(e.cantidad_total)) * 100) : 0}%</span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Badge className={`text-[10px] px-2 py-0.5 border ${cfg.badge}`}>
                      {cfg.label}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}