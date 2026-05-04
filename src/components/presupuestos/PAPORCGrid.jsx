import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
const fmtPct = (n) => `${(Number(n) || 0).toFixed(0)}%`;

function calcItemSubtotal(item, cp, co) {
  const pu_mat = Number(item.pu_mat) || 0;
  const pu_mo  = Number(item.pu_mo)  || 0;
  return (pu_mat + pu_mo) * cp * co * (Number(item.cantidad) || 0);
}

// Calcula el importe certificado según avance
function calcImportes(subtotal, anterior, actual) {
  const ant = Number(anterior) || 0;
  const act = Number(actual)   || 0;
  const acum = Math.min(ant + act, 100);
  return {
    anterior: ant,
    actual: act,
    acumulado: acum,
    imp_anterior: subtotal * ant / 100,
    imp_actual:   subtotal * act / 100,
    imp_acumulado: subtotal * acum / 100,
  };
}

// ── Rubro block para PAPORC ──────────────────────────────────────────────────
function PAPORCRubroBlock({ rubro, idx, cp, co, onChange }) {
  const [expanded, setExpanded] = useState(true);

  const items = rubro.items || [];

  // Totales del rubro
  const rubroTotal = items.reduce((a, item) => a + calcItemSubtotal(item, cp, co), 0);
  const rubroAnterior = items.reduce((a, item) => a + calcImportes(calcItemSubtotal(item, cp, co), item.avance_anterior_pct, item.avance_actual_pct).imp_anterior, 0);
  const rubroActual   = items.reduce((a, item) => a + calcImportes(calcItemSubtotal(item, cp, co), item.avance_anterior_pct, item.avance_actual_pct).imp_actual, 0);
  const rubroAcum     = items.reduce((a, item) => a + calcImportes(calcItemSubtotal(item, cp, co), item.avance_anterior_pct, item.avance_actual_pct).imp_acumulado, 0);
  const rubroPctAcum  = rubroTotal > 0 ? (rubroAcum / rubroTotal) * 100 : 0;

  const updateItemAvance = (iIdx, field, value) => {
    const newItems = [...items];
    newItems[iIdx] = { ...newItems[iIdx], [field]: value };
    onChange({ ...rubro, items: newItems });
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors select-none border-b border-gray-200"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-center h-5 w-5 rounded bg-red-600 text-white text-[10px] font-bold shrink-0">
          {idx + 1}
        </div>
        <span className="text-sm font-semibold text-gray-800 flex-1">{rubro.nombre || `Rubro ${idx + 1}`}</span>
        <div className="flex items-center gap-3 ml-auto shrink-0 text-xs">
          <span className="text-gray-500 tabular-nums">{fmt(rubroTotal)}</span>
          <span className="text-blue-600 tabular-nums font-medium">Acum: {fmt(rubroAcum)} ({fmtPct(rubroPctAcum)})</span>
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
        </div>
      </div>

      {/* Tabla */}
      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-800">
                <th className="text-center px-2 py-2 text-gray-400 font-semibold uppercase tracking-wide text-[10px] w-8 border-r border-gray-700">#</th>
                <th className="text-left px-2 py-2 text-gray-400 font-semibold uppercase tracking-wide text-[10px] w-20 border-r border-gray-700">Código</th>
                <th className="text-left px-2 py-2 text-gray-400 font-semibold uppercase tracking-wide text-[10px] border-r border-gray-700">Descripción</th>
                <th className="text-center px-2 py-2 text-gray-400 font-semibold uppercase tracking-wide text-[10px] w-14 border-r border-gray-700">UM</th>
                <th className="text-right px-2 py-2 text-gray-400 font-semibold uppercase tracking-wide text-[10px] w-16 border-r border-gray-700">Cant.</th>
                <th className="text-right px-2 py-2 text-red-300 font-semibold uppercase tracking-wide text-[10px] w-28 border-r border-gray-700">Subtotal</th>
                {/* PAPORC columns */}
                <th className="text-center px-2 py-2 text-amber-300 font-semibold uppercase tracking-wide text-[10px] w-20 border-r border-gray-700">Anterior %</th>
                <th className="text-center px-2 py-2 text-green-300 font-semibold uppercase tracking-wide text-[10px] w-20 border-r border-gray-700">Avance %</th>
                <th className="text-center px-2 py-2 text-blue-300 font-semibold uppercase tracking-wide text-[10px] w-20 border-r border-gray-700">Acumulado %</th>
                <th className="text-right px-2 py-2 text-amber-300 font-semibold uppercase tracking-wide text-[10px] w-28 border-r border-gray-700">Imp. Anterior</th>
                <th className="text-right px-2 py-2 text-green-300 font-semibold uppercase tracking-wide text-[10px] w-28 border-r border-gray-700">Imp. Actual</th>
                <th className="text-right px-2 py-2 text-blue-300 font-semibold uppercase tracking-wide text-[10px] w-28">Imp. Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, iIdx) => {
                const subtotal = calcItemSubtotal(item, cp, co);
                const { anterior, actual, acumulado, imp_anterior, imp_actual, imp_acumulado } = calcImportes(subtotal, item.avance_anterior_pct, item.avance_actual_pct);
                const isComplete = acumulado >= 100;
                return (
                  <tr key={iIdx} className={`border-b border-gray-100 ${iIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${isComplete ? 'bg-emerald-50/30' : ''}`}>
                    <td className="px-2 py-1.5 text-center text-gray-400 font-mono text-[10px] border-r border-gray-100">
                      {isComplete
                        ? <CheckCircle2 className="h-3 w-3 text-emerald-500 mx-auto" />
                        : <span>{iIdx + 1}</span>
                      }
                    </td>
                    <td className="px-2 py-1.5 font-mono text-gray-500 text-[10px] border-r border-gray-100">{item.codigo || '—'}</td>
                    <td className="px-2 py-1.5 text-gray-700 border-r border-gray-100 max-w-xs">
                      <span className="line-clamp-2 leading-snug">{item.descripcion}</span>
                    </td>
                    <td className="px-2 py-1.5 text-center text-gray-500 border-r border-gray-100">{item.unidad}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-gray-600 border-r border-gray-100">{item.cantidad}</td>
                    <td className="px-2 py-1.5 text-right font-bold text-red-700 tabular-nums border-r border-gray-100">{fmt(subtotal)}</td>

                    {/* Anterior % — readonly, viene del cierre anterior */}
                    <td className="px-1 py-1 border-r border-gray-100 text-center">
                      <span className="inline-block w-16 text-center text-xs font-mono tabular-nums text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                        {anterior}%
                      </span>
                    </td>

                    {/* Avance % — editable */}
                    <td className="px-1 py-1 border-r border-gray-100">
                      <div className="flex items-center gap-1 justify-center">
                        <Input
                          type="number"
                          min={0}
                          max={100 - anterior}
                          step={1}
                          value={item.avance_actual_pct ?? ''}
                          onChange={e => {
                            const v = Math.min(parseFloat(e.target.value) || 0, 100 - anterior);
                            updateItemAvance(iIdx, 'avance_actual_pct', v);
                          }}
                          className="h-7 w-16 text-xs text-center border-green-300 focus:border-green-500 focus-visible:ring-green-200 font-mono tabular-nums"
                        />
                        <span className="text-xs text-gray-400">%</span>
                      </div>
                    </td>

                    {/* Acumulado % — calculado */}
                    <td className="px-1 py-1 border-r border-gray-100 text-center">
                      <span className={`inline-block w-16 text-center text-xs font-mono font-bold tabular-nums px-1.5 py-0.5 rounded border
                        ${acumulado >= 100 ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 
                          acumulado > 0 ? 'bg-blue-100 text-blue-800 border-blue-300' : 
                          'bg-gray-100 text-gray-500 border-gray-200'}`}>
                        {acumulado}%
                      </span>
                    </td>

                    <td className="px-2 py-1.5 text-right tabular-nums text-amber-700 border-r border-gray-100 text-[11px]">{fmt(imp_anterior)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-green-700 border-r border-gray-100 text-[11px] font-semibold">{fmt(imp_actual)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-blue-700 text-[11px] font-bold">{fmt(imp_acumulado)}</td>
                  </tr>
                );
              })}
            </tbody>
            {items.length > 0 && (
              <tfoot>
                <tr className="bg-gray-900 border-t-2 border-gray-600">
                  <td colSpan={5} className="px-3 py-2 text-xs font-bold text-gray-200">SUBTOTAL {rubro.nombre}</td>
                  <td className="px-2 py-2 text-right font-bold text-red-300 tabular-nums text-xs">{fmt(rubroTotal)}</td>
                  <td className="px-2 py-2 text-center text-amber-300 font-bold text-xs tabular-nums">—</td>
                  <td className="px-2 py-2 text-center text-green-300 font-bold text-xs tabular-nums">—</td>
                  <td className="px-2 py-2 text-center text-blue-300 font-bold text-xs tabular-nums">{fmtPct(rubroPctAcum)}</td>
                  <td className="px-2 py-2 text-right text-amber-300 font-bold tabular-nums text-xs">{fmt(rubroAnterior)}</td>
                  <td className="px-2 py-2 text-right text-green-300 font-bold tabular-nums text-xs">{fmt(rubroActual)}</td>
                  <td className="px-2 py-2 text-right text-blue-300 font-bold tabular-nums text-xs">{fmt(rubroAcum)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

// ── PAMON summary banner ──────────────────────────────────────────────────────
function PAMONBanner({ totalPresupuesto, totalAcumulado, totalActual, totalAnterior }) {
  const pctAcum    = totalPresupuesto > 0 ? (totalAcumulado / totalPresupuesto) * 100 : 0;
  const pctActual  = totalPresupuesto > 0 ? (totalActual    / totalPresupuesto) * 100 : 0;
  const pctAnterior= totalPresupuesto > 0 ? (totalAnterior  / totalPresupuesto) * 100 : 0;

  return (
    <div className="rounded-xl overflow-hidden border border-gray-700 shadow-md">
      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between" style={{ background: '#1a1a2e' }}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">PAMON — Porcentaje de Avance Mensual</p>
          <p className="text-2xl font-bold tabular-nums text-white">{fmtPct(pctActual)}</p>
          <p className="text-xs text-gray-400 mt-0.5">avance del período actual</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Obra acumulada</p>
          <p className="text-xl font-bold text-blue-400 tabular-nums">{fmtPct(pctAcum)}</p>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="px-5 py-3 bg-gray-900 space-y-2">
        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
          <span>Anterior: {fmtPct(pctAnterior)}</span>
          <span>Actual: {fmtPct(pctActual)}</span>
          <span>Acumulado: {fmtPct(pctAcum)}</span>
        </div>
        <div className="h-4 rounded-full bg-gray-700 overflow-hidden relative">
          {/* Anterior — amarillo */}
          <div className="absolute left-0 top-0 h-full rounded-l-full bg-amber-500 transition-all"
            style={{ width: `${Math.min(pctAnterior, 100)}%` }} />
          {/* Actual — verde */}
          <div className="absolute top-0 h-full bg-green-500 transition-all"
            style={{ left: `${Math.min(pctAnterior, 100)}%`, width: `${Math.min(pctActual, 100 - pctAnterior)}%` }} />
        </div>
        <div className="flex items-center gap-4 text-[10px] mt-2">
          <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-sm bg-amber-500" /><span className="text-gray-400">Anterior: {fmt(totalAnterior)}</span></div>
          <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-sm bg-green-500" /><span className="text-gray-400">Actual: {fmt(totalActual)}</span></div>
          <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-sm bg-blue-500" /><span className="text-gray-400">Acumulado: {fmt(totalAcumulado)}</span></div>
        </div>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-3 divide-x divide-gray-700 bg-gray-800">
        {[
          { label: 'Total Presupuesto', value: fmt(totalPresupuesto), color: 'text-gray-300' },
          { label: 'Certificado Actual', value: fmt(totalActual), color: 'text-green-400' },
          { label: 'Acumulado Certificado', value: fmt(totalAcumulado), color: 'text-blue-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="px-4 py-3 text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
            <p className={`text-sm font-bold tabular-nums mt-0.5 ${color}`}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main PAPORCGrid ──────────────────────────────────────────────────────────
export default function PAPORCGrid({ rubros, onChange, coefPase, coefOferta }) {
  const cp = coefPase  ?? 1.6504;
  const co = coefOferta ?? 1.38;

  // Calcular totales globales
  let totalPresupuesto = 0, totalAnterior = 0, totalActual = 0, totalAcumulado = 0;
  (rubros || []).forEach(rubro => {
    (rubro.items || []).forEach(item => {
      const sub = calcItemSubtotal(item, cp, co);
      const { imp_anterior, imp_actual, imp_acumulado } = calcImportes(sub, item.avance_anterior_pct, item.avance_actual_pct);
      totalPresupuesto += sub;
      totalAnterior    += imp_anterior;
      totalActual      += imp_actual;
      totalAcumulado   += imp_acumulado;
    });
  });

  const handleRubroChange = (idx, rubro) => {
    const next = [...(rubros || [])];
    next[idx] = rubro;
    onChange(next);
  };

  // Botón para aplicar avance global (50% o 100%)
  const applyGlobalAvance = (pct) => {
    const next = (rubros || []).map(rubro => ({
      ...rubro,
      items: (rubro.items || []).map(item => {
        const anterior = Number(item.avance_anterior_pct) || 0;
        const disponible = Math.max(0, pct - anterior);
        return { ...item, avance_actual_pct: disponible };
      }),
    }));
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {/* PAMON Banner */}
      <PAMONBanner
        totalPresupuesto={totalPresupuesto}
        totalAcumulado={totalAcumulado}
        totalActual={totalActual}
        totalAnterior={totalAnterior}
      />

      {/* Acciones rápidas */}
      <div className="flex items-center gap-3 px-1">
        <span className="text-xs text-gray-500 font-medium">Aplicar avance rápido:</span>
        <Button size="sm" variant="outline"
          className="h-7 text-xs gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
          onClick={() => applyGlobalAvance(50)}>
          50% a todos los ítems
        </Button>
        <Button size="sm" variant="outline"
          className="h-7 text-xs gap-1.5 border-green-300 text-green-700 hover:bg-green-50"
          onClick={() => applyGlobalAvance(100)}>
          100% a todos los ítems
        </Button>
        <span className="ml-auto text-[10px] text-gray-400 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          El avance actual no puede superar 100% acumulado por ítem
        </span>
      </div>

      {/* Rubros */}
      {(rubros || []).length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>Sin rubros en el presupuesto. Cargalos primero en la pestaña PCP.</p>
        </div>
      ) : (
        (rubros || []).map((rubro, idx) => (
          <PAPORCRubroBlock
            key={idx}
            rubro={rubro}
            idx={idx}
            cp={cp}
            co={co}
            onChange={(r) => handleRubroChange(idx, r)}
          />
        ))
      )}
    </div>
  );
}