import React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

// Usa los campos pre-computados (_detalle, _comuna, etc.) para cero regex por render
const ProyectoFila = React.memo(function ProyectoFila({ project, selected, onToggle, onOpen, onDelete, canDelete }) {
  const { _detalle, _comuna, _jefe, _inspector, _colors, _avance, _fmtMonto, _fmtAI, _fmtAR } = project;

  return (
    <div
      className={`group grid items-center border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors cursor-pointer text-xs
        ${selected ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
      style={{ gridTemplateColumns: 'var(--cols)' }}
      onClick={() => onOpen(project)}
    >
      <div className="px-2 py-2 flex items-center justify-center" onClick={e => { e.stopPropagation(); onToggle(project.id); }}>
        <Checkbox checked={selected} />
      </div>
      <div className="px-2 py-2 font-mono text-slate-400 font-semibold">{_comuna}</div>
      <div className="px-2 py-2 text-slate-300 truncate" title={project.address}>{project.address || '—'}</div>
      <div className="px-2 py-2 text-slate-300 truncate" title={project.client_name}>{project.client_name || '—'}</div>
      <div className="px-2 py-2 text-white font-medium truncate" title={project.name}>{project.name}</div>
      <div className="px-2 py-2 text-right font-mono text-slate-300 tabular-nums">{_fmtMonto}</div>
      <div className="px-2 py-2 font-mono text-slate-400 text-center">{project.code || '—'}</div>
      <div className="px-2 py-2">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${_colors.bg} ${_colors.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${_colors.dot} shrink-0`} />
          {_detalle}
        </span>
      </div>
      <div className="px-2 py-2 text-center font-mono text-slate-400">{_fmtAI}</div>
      <div className="px-2 py-2 text-center font-mono text-slate-400">{_fmtAR}</div>
      <div className="px-2 py-2">
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${_avance >= 100 ? 'bg-emerald-500' : _avance > 50 ? 'bg-blue-500' : 'bg-yellow-500'}`}
              style={{ width: `${Math.min(100, _avance)}%` }}
            />
          </div>
          <span className={`text-xs font-bold tabular-nums w-8 text-right ${_avance >= 100 ? 'text-emerald-400' : 'text-slate-300'}`}>
            {_avance}%
          </span>
        </div>
      </div>
      <div className="px-2 py-2 text-slate-400 truncate hidden xl:block" title={_jefe}>{_jefe}</div>
      <div className="px-2 py-2 text-slate-400 truncate hidden xl:block" title={_inspector}>{_inspector}</div>
      <div className="px-2 py-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
        {canDelete && (
          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:bg-red-500/10"
            onClick={() => onDelete(project.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}, (prev, next) =>
  // Custom comparator: re-render solo si cambian los campos que importan
  prev.selected === next.selected &&
  prev.project.id === next.project.id &&
  prev.project.updated_date === next.project.updated_date &&
  prev.canDelete === next.canDelete
);

export default ProyectoFila;