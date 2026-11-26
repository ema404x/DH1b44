import React, { useState } from 'react';
import { Building2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { normalizarTexto } from '@/components/assets/bapro/sedesBapro';

/** Panel lateral de sedes (desktop). options[0] es "Todas las sedes". */
export default function SedesPanelBapro({ options, value, onChange }) {
  const [q, setQ] = useState('');
  const t = normalizarTexto(q);
  const lista = options.filter((o, i) => i === 0 || !t || normalizarTexto(o.label).includes(t));

  return (
    <aside className="sticky top-4 hidden max-h-[calc(100vh-8rem)] w-[260px] shrink-0 flex-col self-start rounded-xl border bg-card lg:flex">
      <div className="flex items-center gap-2 border-b px-3 py-2.5 text-sm font-semibold">
        <Building2 className="h-4 w-4 text-primary" /> Sedes
      </div>
      <div className="relative border-b p-2">
        <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Filtrar sedes…" value={q} onChange={e => setQ(e.target.value)} className="h-8 pl-7" />
      </div>
      <div className="flex-1 overflow-y-auto p-1.5">
        {lista.map(o => {
          const activa = o.value === value;
          return (
            <button key={o.value} type="button" onClick={() => onChange(o.value)}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${activa ? 'bg-primary/15 font-medium text-primary' : 'hover:bg-accent'}`}>
              <span className="flex-1 truncate">{o.label}</span>
              <span className={`text-xs tabular-nums ${activa ? 'text-primary' : 'text-muted-foreground'}`}>{o.count}</span>
            </button>
          );
        })}
        {lista.length === 1 && t && <p className="px-2.5 py-2 text-xs text-muted-foreground">Ninguna sede coincide</p>}
      </div>
    </aside>
  );
}