import React from 'react';
import { Search, X, ClipboardList, History } from 'lucide-react';

const TIPOS = [
  { value: 'todos', label: 'Todos los tipos' },
  { value: 'mantenimiento_preventivo', label: 'Mant. Preventivo' },
  { value: 'mantenimiento_correctivo', label: 'Mant. Correctivo' },
  { value: 'instalacion', label: 'Instalación' },
  { value: 'inspeccion', label: 'Inspección' },
  { value: 'reparacion', label: 'Reparación' },
  { value: 'emergencia', label: 'Emergencia' },
];

const PRIORIDADES = [
  { value: 'todos', label: 'Toda prioridad' },
  { value: 'urgente', label: 'Urgente' },
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Media' },
  { value: 'baja', label: 'Baja' },
];

export default function MisOrdenesFiltros({ filtros, onChange, onLimpiar, vista, onVistaChange, counts }) {
  const hayFiltros = filtros.texto || filtros.tipo !== 'todos' || filtros.prioridad !== 'todos';

  return (
    <div className="space-y-3">
      {/* Toggle Activas / Historial */}
      <div className="flex gap-1 p-1 bg-slate-900/50 rounded-xl border border-slate-800">
        <button
          onClick={() => onVistaChange('activas')}
          className={`flex-1 h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
            vista === 'activas' ? 'bg-primary text-primary-foreground' : 'text-slate-400 hover:text-white'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          Activas {counts?.activas != null && <span className="opacity-70">({counts.activas})</span>}
        </button>
        <button
          onClick={() => onVistaChange('historial')}
          className={`flex-1 h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
            vista === 'historial' ? 'bg-primary text-primary-foreground' : 'text-slate-400 hover:text-white'
          }`}
        >
          <History className="h-4 w-4" />
          Historial {counts?.historial != null && <span className="opacity-70">({counts.historial})</span>}
        </button>
      </div>

      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            value={filtros.texto}
            onChange={e => onChange({ ...filtros, texto: e.target.value })}
            placeholder="Buscar por título, ubicación o código…"
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:border-primary/50 focus:outline-none"
          />
        </div>
        <select
          value={filtros.tipo}
          onChange={e => onChange({ ...filtros, tipo: e.target.value })}
          className="h-10 px-3 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-white focus:border-primary/50 focus:outline-none"
        >
          {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select
          value={filtros.prioridad}
          onChange={e => onChange({ ...filtros, prioridad: e.target.value })}
          className="h-10 px-3 rounded-lg bg-slate-900/60 border border-slate-800 text-sm text-white focus:border-primary/50 focus:outline-none"
        >
          {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <button
          onClick={onLimpiar}
          className={`h-10 px-3 rounded-lg border text-sm font-medium transition-colors flex items-center gap-1.5 ${
            hayFiltros
              ? 'bg-primary/15 border-primary/30 text-primary hover:bg-primary/25'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
          }`}
        >
          <X className="h-4 w-4" />
          Limpiar panel
        </button>
      </div>
    </div>
  );
}