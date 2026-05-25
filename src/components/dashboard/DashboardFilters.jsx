import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Filter, X, CalendarDays, User, AlertTriangle } from 'lucide-react';

const PRIORITY_OPTIONS = [
  { value: 'urgente', label: 'Urgente', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  { value: 'alta',    label: 'Alta',    color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  { value: 'media',   label: 'Media',   color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { value: 'baja',    label: 'Baja',    color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
];

const DATE_PRESETS = [
  { value: '7d',  label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: '3m',  label: '3 meses' },
  { value: 'all', label: 'Todo' },
];

export default function DashboardFilters({ filters, onChange, jefes = [] }) {
  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.dateRange !== 'all') n++;
    if (filters.jefeSitio) n++;
    if (filters.priority) n++;
    return n;
  }, [filters]);

  const set = (key, val) => onChange({ ...filters, [key]: val });

  const reset = () => onChange({ dateRange: 'all', jefeSitio: '', priority: '' });

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/8 bg-slate-800/40 backdrop-blur-xl px-3 py-2.5">
      {/* Icono + label */}
      <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold mr-1">
        <Filter className="h-3.5 w-3.5" />
        Filtrar
        {activeCount > 0 && (
          <span className="ml-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </div>

      {/* Fecha */}
      <div className="flex items-center gap-1 rounded-lg border border-white/10 p-0.5 bg-white/3">
        <CalendarDays className="h-3.5 w-3.5 text-slate-500 ml-1.5" />
        {DATE_PRESETS.map(p => (
          <button
            key={p.value}
            onClick={() => set('dateRange', p.value)}
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
              filters.dateRange === p.value
                ? 'bg-primary text-primary-foreground'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Jefe de sitio */}
      {jefes.length > 0 && (
        <div className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-slate-500" />
          <select
            value={filters.jefeSitio}
            onChange={e => set('jefeSitio', e.target.value)}
            className="h-7 rounded-lg border border-white/10 bg-white/5 text-[11px] text-slate-300 px-2 focus:outline-none focus:border-primary/50"
          >
            <option value="">Todos los jefes</option>
            {jefes.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>
      )}

      {/* Prioridad */}
      <div className="flex items-center gap-1">
        <AlertTriangle className="h-3.5 w-3.5 text-slate-500" />
        {PRIORITY_OPTIONS.map(p => (
          <button
            key={p.value}
            onClick={() => set('priority', filters.priority === p.value ? '' : p.value)}
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium border transition-all ${
              filters.priority === p.value ? p.color : 'border-transparent text-slate-500 hover:text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Reset */}
      {activeCount > 0 && (
        <button
          onClick={reset}
          className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-red-400 transition-colors ml-auto"
        >
          <X className="h-3.5 w-3.5" /> Limpiar
        </button>
      )}
    </div>
  );
}