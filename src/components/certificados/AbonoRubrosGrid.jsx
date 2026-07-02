import React from 'react';
import { Card } from '@/components/ui/card';
import { ChevronRight, Users } from 'lucide-react';
import { RUBRO_PRESETS, getRubroConfig, parseMonto, fmt } from './abonoUtils';

/**
 * Grid de carpetas por rubro.
 * Muestra todos los rubros preset + cualquier rubro custom encontrado en los datos.
 * Un rubro puede agrupar múltiples proveedores (contratistas).
 */
export default function AbonoRubrosGrid({ abonos, onSelect }) {
  // Rubros custom presentes en los datos pero no en presets
  const customRubros = [...new Set(
    abonos.map(a => a.rubro).filter(r => r && !RUBRO_PRESETS.find(p => p.value === r))
  )];
  const allRubros = [...RUBRO_PRESETS.map(p => p.value), ...customRubros];

  const getStats = (rubro) => {
    const items = abonos.filter(a => a.rubro === rubro);
    const proveedores = [...new Set(items.map(a => a.contratista).filter(Boolean))];
    return {
      count: items.length,
      activos: items.filter(a => a.estado === 'activo').length,
      totalMensual: items.filter(a => a.estado === 'activo').reduce((acc, a) => acc + parseMonto(a.monto_mensual), 0),
      lotesPendientes: items.filter(a => !a.lote_generado && a.estado === 'activo').length,
      proveedores,
    };
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {allRubros.map(rubro => {
        const cfg = getRubroConfig(rubro);
        const stats = getStats(rubro);
        const Icon = cfg.Icon;
        const multiProv = stats.proveedores.length > 1;
        return (
          <button key={rubro} onClick={() => onSelect(rubro)} className="text-left group">
            <Card className="p-4 hover:border-primary/40 hover:shadow-md transition-all card-lift h-full">
              <div className="flex items-start justify-between">
                <div className={`h-11 w-11 rounded-xl ${cfg.bg} ${cfg.border} border flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${cfg.color}`} />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                  {stats.count}
                </span>
              </div>
              <p className="font-semibold text-sm text-foreground mt-3">{cfg.label}</p>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-xs text-muted-foreground">
                  {stats.count} abono{stats.count !== 1 ? 's' : ''}
                </span>
                {stats.lotesPendientes > 0 && (
                  <span className="text-[10px] text-amber-400 font-medium">{stats.lotesPendientes} sin lote</span>
                )}
              </div>
              {/* Proveedores */}
              <div className="mt-1.5">
                <div className="flex items-center gap-1">
                  <Users className={`h-3 w-3 ${multiProv ? 'text-indigo-400' : 'text-muted-foreground'}`} />
                  <span className={`text-[11px] font-medium ${multiProv ? 'text-indigo-300' : 'text-muted-foreground'}`}>
                    {stats.proveedores.length} proveedor{stats.proveedores.length !== 1 ? 'es' : ''}
                  </span>
                </div>
                {stats.proveedores.length > 0 && (
                  <p className="text-[10px] text-muted-foreground/80 mt-0.5 truncate">
                    {stats.proveedores.join(' · ')}
                  </p>
                )}
              </div>
              {stats.totalMensual > 0 && (
                <p className="text-xs font-bold text-emerald-400 mt-1.5">
                  {fmt(stats.totalMensual)}<span className="text-muted-foreground font-normal">/mes</span>
                </p>
              )}
              <div className="flex items-center gap-1 text-[11px] text-primary mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                Abrir carpeta <ChevronRight className="h-3 w-3" />
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}