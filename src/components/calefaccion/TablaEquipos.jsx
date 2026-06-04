import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';

// Agrupa los registros por escuela y muestra cada una una sola vez,
// expandible para ver el detalle por tipo de equipo.
export default function TablaEquipos({ equipos, estadoConfig, tipoLabels }) {
  const [expandidas, setExpandidas] = useState({});

  if (equipos.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm">
        Sin registros con los filtros seleccionados
      </div>
    );
  }

  // Agrupar por escuela
  const grupoMap = {};
  for (const e of equipos) {
    const key = e.escuela;
    if (!grupoMap[key]) {
      grupoMap[key] = {
        escuela: e.escuela,
        jefe_sitio: e.jefe_sitio,
        comuna: e.comuna,
        registros: [],
      };
    }
    grupoMap[key].registros.push(e);
  }
  const grupos = Object.values(grupoMap);

  const toggle = (escuela) =>
    setExpandidas(prev => ({ ...prev, [escuela]: !prev[escuela] }));

  // Estado peor de la escuela (para badge resumen)
  const prioridad = { critico: 0, alerta: 1, normal: 2, optimo: 3 };
  const peorEstado = (registros) =>
    registros.reduce((acc, r) =>
      (prioridad[r.estado] ?? 4) < (prioridad[acc] ?? 4) ? r.estado : acc,
      'optimo');

  return (
    <div className="rounded-xl border border-slate-700/50 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-800/60 border-b border-slate-700/50">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Escuela</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden sm:table-cell">Jefe Sitio</th>
            <th className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Cmna</th>
            <th className="text-center px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Tipos</th>
            <th className="text-right px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Total</th>
            <th className="text-right px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">%</th>
            <th className="text-center px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Estado</th>
            <th className="w-8 px-2 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) => {
            const expanded = !!expandidas[g.escuela];
            const totalUnids = g.registros.reduce((s, r) => s + Math.round(r.cantidad_total || 0), 0);
            const totalFunc  = g.registros.reduce((s, r) => s + Math.round(r.cantidad_funciona || 0), 0);
            const pctGlobal  = totalUnids > 0 ? Math.round((totalFunc / totalUnids) * 100) : 0;
            const estado     = peorEstado(g.registros);
            const cfg        = estadoConfig[estado] || estadoConfig.normal;

            return (
              <React.Fragment key={g.escuela}>
                {/* Fila resumen de la escuela */}
                <tr
                  className="border-b border-slate-700/40 hover:bg-slate-800/40 transition-colors cursor-pointer"
                  onClick={() => toggle(g.escuela)}
                >
                  <td className="px-4 py-3 text-white text-xs font-semibold max-w-[200px] truncate">
                    {g.escuela}
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs max-w-[140px] truncate hidden sm:table-cell">
                    {g.jefe_sitio || '—'}
                  </td>
                  <td className="px-3 py-3 text-slate-400 text-xs">{g.comuna}</td>
                  <td className="px-3 py-3 text-center">
                    <span className="text-xs bg-slate-700/60 text-slate-300 rounded-full px-2 py-0.5">
                      {g.registros.length} tipo{g.registros.length !== 1 ? 's' : ''}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-white text-xs text-right font-bold">{totalUnids}</td>
                  <td className="px-3 py-3 text-xs text-right">
                    <span className={`${cfg.color} font-bold`}>{pctGlobal}%</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Badge className={`text-[10px] px-2 py-0.5 border ${cfg.badge}`}>
                      {cfg.label}
                    </Badge>
                  </td>
                  <td className="px-2 py-3 text-center text-slate-400">
                    {expanded
                      ? <ChevronDown className="h-3.5 w-3.5 inline" />
                      : <ChevronRight className="h-3.5 w-3.5 inline" />}
                  </td>
                </tr>

                {/* Filas de detalle por tipo (colapsadas por defecto) */}
                {expanded && g.registros.map((e, idx) => {
                  const ecfg = estadoConfig[e.estado] || estadoConfig.normal;
                  const total = Math.round(e.cantidad_total);
                  const func  = Math.round(e.cantidad_funciona);
                  const noFunc = total - func;
                  const pct   = total > 0 ? Math.round((func / total) * 100) : 0;
                  return (
                    <tr key={e.id || idx} className="border-b border-slate-700/20 bg-slate-900/40 hover:bg-slate-800/20 transition-colors">
                      <td className="pl-8 pr-4 py-2 text-slate-400 text-xs italic" colSpan={1}>
                        └ {tipoLabels[e.tipo_equipo] || e.tipo_equipo}
                      </td>
                      <td className="hidden sm:table-cell" />
                      <td className="px-3 py-2 text-slate-500 text-xs">{e.comuna}</td>
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2 text-slate-300 text-xs text-right">{total}</td>
                      <td className="px-3 py-2 text-xs text-right">
                        <span className={`${ecfg.color} font-semibold`}>{pct}%</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge className={`text-[9px] px-1.5 py-0 border ${ecfg.badge}`}>
                          {ecfg.label}
                        </Badge>
                      </td>
                      <td />
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}