import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const DEFL_COEF = 6.37;

function calcItem(item, cp, co) {
  const pu_mat = Number(item.pu_mat) || 0;
  const pu_mo  = Number(item.pu_mo)  || 0;
  const total  = (pu_mat + pu_mo) * cp * co * (Number(item.cantidad) || 0);
  return total;
}

const DAY_W = 28; // px per day cell

export default function PlanTrabajos({ form, onBack }) {
  const cp = Number(form.coef_pase)   || 1.6504;
  const co = Number(form.coef_oferta) || 1.38;
  const plazo = parseInt(form.plazo) || 30;
  const days = Array.from({ length: plazo }, (_, i) => i + 1);

  // marks[rubroIdx][itemIdx][day] = true/false
  const [marks, setMarks] = useState({});
  const [dragging, setDragging] = useState(null); // {ri, ii, active}
  const [exporting, setExporting] = useState(false);

  const toggleMark = useCallback((ri, ii, day, force) => {
    setMarks(prev => {
      const key = `${ri}-${ii}-${day}`;
      const current = prev[key] ?? false;
      return { ...prev, [key]: force !== undefined ? force : !current };
    });
  }, []);

  const handleMouseDown = (ri, ii, day) => {
    const key = `${ri}-${ii}-${day}`;
    const newVal = !(marks[key] ?? false);
    setDragging({ ri, ii, active: newVal });
    toggleMark(ri, ii, day, newVal);
  };

  const handleMouseEnter = (ri, ii, day) => {
    if (dragging) toggleMark(ri, ii, day, dragging.active);
  };

  const handleMouseUp = () => setDragging(null);

  const handleExport = async () => {
    if (!form.id) { toast.warning('Guardá el presupuesto antes de exportar'); return; }
    setExporting(true);
    try {
      const res = await base44.functions.invoke('exportPresupuestoPCP', { presupuestoId: form.id });
      if (res.data?.file_url) {
        const a = document.createElement('a');
        a.href = res.data.file_url;
        a.download = res.data.filename || 'PCP_MEJORES.xlsx';
        a.click();
        toast.success('Excel descargado');
      }
    } catch { toast.error('Error al exportar'); }
    setExporting(false);
  };

  const rubros = form.rubros || [];

  return (
    <div className="flex flex-col min-h-full" onMouseUp={handleMouseUp}>
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 -mx-6 px-6 py-3 mb-4 flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Volver al Presupuesto
        </button>
        <div className="h-4 w-px bg-gray-200" />
        <span className="text-sm font-semibold text-gray-900">Plan de Trabajos</span>
        <span className="text-xs text-gray-400 font-medium ml-1">— {form.titulo || form.codigo}</span>
        <div className="ml-auto">
          <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting}
            className="h-8 gap-2 text-xs border-gray-300 hover:border-gray-400">
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Exportar Excel PCP
          </Button>
        </div>
      </div>

      {/* Info header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5 text-xs">
        {[
          ['Obra', form.titulo || '—'],
          ['Licitación', form.licitacion || '—'],
          ['Plazo', `${plazo} días`],
          ['Coef. Pase / Oferta', `${cp} / ${co}`],
        ].map(([label, value]) => (
          <div key={label} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
            <p className="text-gray-400 font-medium uppercase tracking-wider text-[10px]">{label}</p>
            <p className="text-gray-800 font-semibold mt-0.5 truncate">{value}</p>
          </div>
        ))}
      </div>

      {/* Gantt table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto" style={{ userSelect: 'none' }}>
          <table className="border-collapse text-xs" style={{ minWidth: `${300 + plazo * DAY_W}px` }}>
            <thead>
              {/* Row 1: group headers */}
              <tr className="bg-gray-900">
                <th className="sticky left-0 z-10 bg-gray-900 text-white font-semibold text-left px-3 py-2.5 w-72 border-r border-gray-700">
                  RUBRO / ÍTEM
                </th>
                <th className="text-white font-semibold px-2 py-2.5 w-20 text-right border-r border-gray-700 whitespace-nowrap">
                  SUBTOTAL
                </th>
                <th colSpan={plazo} className="text-white font-semibold text-center py-2.5 border-r border-gray-700">
                  DÍAS — PLAZO: {plazo} días
                </th>
              </tr>
              {/* Row 2: day numbers */}
              <tr className="bg-gray-800">
                <th className="sticky left-0 z-10 bg-gray-800 border-r border-gray-600" />
                <th className="bg-gray-800 border-r border-gray-600" />
                {days.map(d => (
                  <th key={d} style={{ width: DAY_W, minWidth: DAY_W }}
                    className={`text-center py-1.5 text-[10px] font-bold border-r border-gray-600 ${
                      d % 7 === 0 ? 'bg-gray-700 text-red-300' :
                      d % 7 === 6 ? 'bg-gray-700 text-red-300' :
                      'text-gray-300'
                    }`}>
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rubros.map((rubro, ri) => {
                const rubroTotal = (rubro.items || []).reduce((a, item) => a + calcItem(item, cp, co), 0);
                const fmt = (n) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n || 0);
                return (
                  <React.Fragment key={ri}>
                    {/* Rubro header row */}
                    <tr className="bg-red-700 select-none">
                      <td className="sticky left-0 z-10 bg-red-700 px-3 py-2 font-bold text-white uppercase tracking-wide text-[11px] border-r border-red-600 border-b border-red-600">
                        {rubro.nombre || `Rubro ${ri + 1}`}
                      </td>
                      <td className="px-2 py-2 text-right font-bold text-white tabular-nums whitespace-nowrap border-r border-red-600 border-b border-red-600">
                        ${fmt(rubroTotal)}
                      </td>
                      {days.map(d => (
                        <td key={d} style={{ width: DAY_W }}
                          className={`border-r border-b border-red-600 ${d % 7 === 0 || d % 7 === 6 ? 'bg-red-800' : ''}`} />
                      ))}
                    </tr>
                    {/* Item rows */}
                    {(rubro.items || []).map((item, ii) => {
                      const subtotal = calcItem(item, cp, co);
                      return (
                        <tr key={ii} className={`${ii % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-red-50/40 transition-colors`}>
                          <td className="sticky left-0 z-10 bg-inherit px-3 py-1.5 border-r border-b border-gray-200 max-w-[280px]">
                            <div className="flex items-start gap-2">
                              <span className="text-[10px] text-gray-400 font-mono shrink-0 mt-0.5">{item.codigo || '—'}</span>
                              <span className="text-gray-700 text-[11px] leading-snug line-clamp-2">{item.descripcion || '—'}</span>
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-[11px] font-semibold text-gray-600 border-r border-b border-gray-200 whitespace-nowrap">
                            ${fmt(subtotal)}
                          </td>
                          {days.map(d => {
                            const key = `${ri}-${ii}-${d}`;
                            const marked = marks[key] ?? false;
                            return (
                              <td key={d} style={{ width: DAY_W, minWidth: DAY_W }}
                                className={`border-r border-b border-gray-200 cursor-pointer select-none transition-colors ${
                                  d % 7 === 0 || d % 7 === 6 ? 'bg-gray-100' : ''
                                } ${marked ? '!bg-red-600' : 'hover:bg-red-100'}`}
                                onMouseDown={() => handleMouseDown(ri, ii, d)}
                                onMouseEnter={() => handleMouseEnter(ri, ii, d)}
                              >
                                {marked && (
                                  <div className="w-full h-full flex items-center justify-center" style={{ height: 28 }}>
                                    <div className="w-3 h-3 rounded-sm bg-red-700 opacity-60" />
                                  </div>
                                )}
                                {!marked && <div style={{ height: 28 }} />}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}

              {/* GENERALES row */}
              <tr className="bg-gray-700 select-none">
                <td className="sticky left-0 z-10 bg-gray-700 px-3 py-2 font-bold text-white uppercase tracking-wide text-[11px] border-r border-gray-600 border-b border-gray-600">
                  GENERALES — VOLQUETES — LIMPIEZA
                </td>
                <td className="border-r border-b border-gray-600" />
                {days.map(d => (
                  <td key={d} style={{ width: DAY_W }}
                    className={`border-r border-b border-gray-600 ${d % 7 === 0 || d % 7 === 6 ? 'bg-gray-800' : ''}`} />
                ))}
              </tr>
              {['Andamios', 'Volquetes', 'Acarreo de materiales', 'Limpieza de Obra', 'Tramitaciones'].map((g, gi) => (
                <tr key={g} className={gi % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="sticky left-0 z-10 bg-inherit px-3 py-1.5 text-gray-600 text-[11px] border-r border-b border-gray-200">{g}</td>
                  <td className="border-r border-b border-gray-200" />
                  {days.map(d => {
                    const key = `gen-${gi}-${d}`;
                    const marked = marks[key] ?? false;
                    return (
                      <td key={d} style={{ width: DAY_W }}
                        className={`border-r border-b border-gray-200 cursor-pointer select-none ${
                          d % 7 === 0 || d % 7 === 6 ? 'bg-gray-100' : ''
                        } ${marked ? '!bg-red-600' : 'hover:bg-red-100'}`}
                        onMouseDown={() => {
                          const newVal = !marked;
                          setDragging({ ri: 'gen', ii: gi, active: newVal });
                          setMarks(p => ({ ...p, [key]: newVal }));
                        }}
                        onMouseEnter={() => {
                          if (dragging) setMarks(p => ({ ...p, [key]: dragging.active }));
                        }}
                      >
                        <div style={{ height: 28 }} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-sm bg-red-600" />
          <span>Día de trabajo planificado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-sm bg-gray-200 border border-gray-300" />
          <span>Fin de semana</span>
        </div>
        <span className="text-gray-400">— Hacé click y arrastrá para marcar rangos</span>
      </div>
    </div>
  );
}