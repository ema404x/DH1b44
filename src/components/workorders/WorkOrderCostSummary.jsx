import React from 'react';
import { DollarSign, Clock, Package, TrendingUp } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

export default function WorkOrderCostSummary({ materials = [], timeLogs = [], estimatedHours, actualHours }) {
  const materialCost = materials.reduce((s, m) => s + (m.quantity * m.unit_cost || 0), 0);
  const laborHours = timeLogs.reduce((s, l) => s + (l.hours || 0), 0);
  const totalCost = materialCost;
  const hoursEfficiency = estimatedHours > 0 ? Math.round(((actualHours || laborHours) / estimatedHours) * 100) : null;

  return (
    <div className="bg-gradient-to-br from-primary/5 to-blue-50 border border-primary/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-primary" />
        <span className="text-sm font-bold">Resumen de Costos</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/70 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Package className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-[10px] uppercase font-semibold text-muted-foreground">Materiales</span>
          </div>
          <div className="text-base font-bold text-blue-700">{fmt(materialCost)}</div>
          <div className="text-[10px] text-muted-foreground">{materials.length} ítem{materials.length !== 1 ? 's' : ''}</div>
        </div>

        <div className="bg-white/70 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="h-3.5 w-3.5 text-indigo-600" />
            <span className="text-[10px] uppercase font-semibold text-muted-foreground">Horas Trabajadas</span>
          </div>
          <div className="text-base font-bold text-indigo-700">{laborHours}h</div>
          <div className="text-[10px] text-muted-foreground">{timeLogs.length} registro{timeLogs.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {hoursEfficiency !== null && (
        <div className="bg-white/70 rounded-lg p-2.5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">Eficiencia de Tiempo</span>
            </div>
            <span className={`text-xs font-bold ${hoursEfficiency <= 100 ? 'text-emerald-600' : 'text-red-600'}`}>
              {hoursEfficiency}%
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${hoursEfficiency <= 100 ? 'bg-emerald-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(hoursEfficiency, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>Estimado: {estimatedHours}h</span>
            <span>Real: {actualHours || laborHours}h</span>
          </div>
        </div>
      )}

      <div className="border-t border-primary/20 pt-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-muted-foreground">Costo Total</span>
        <span className="text-lg font-bold text-primary">{fmt(totalCost)}</span>
      </div>
    </div>
  );
}