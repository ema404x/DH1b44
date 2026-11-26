import React, { useState } from 'react';
import { Building2, Search, MoreVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { normalizarTexto } from '@/components/assets/bapro/sedesBapro';
import { TIPO_SEDE, SedeDot } from '@/components/assets/bapro/tipoSede';

const FILTROS = [
  { key: 'all', label: 'Todas' },
  { key: 'propia', label: 'Propias' },
  { key: 'tercerizada', label: 'Tercerizadas' },
  { key: 'costa', label: 'Costa' },
];

/** Panel lateral de sedes (desktop). options[0] es "Todas las sedes". options[i].tipo = tipo_sede. */
export default function SedesPanelBapro({ options, value, onChange, puedeEditarTipo, onCambiarTipo }) {
  const [q, setQ] = useState('');
  const [tipoF, setTipoF] = useState('all');
  const t = normalizarTexto(q);
  const lista = options.filter((o, i) => i === 0 || (
    (!t || normalizarTexto(o.label).includes(t)) &&
    (tipoF === 'all' || (o.tipo || 'propia') === tipoF)
  ));

  return (
    <aside className="sticky top-4 hidden max-h-[calc(100vh-8rem)] w-[260px] shrink-0 flex-col self-start rounded-xl border bg-card lg:flex">
      <div className="flex items-center gap-2 border-b px-3 py-2.5 text-sm font-semibold">
        <Building2 className="h-4 w-4 text-primary" /> Sedes
      </div>
      <p className="border-b px-3 py-1.5 text-[11px] text-muted-foreground">
        <span style={{ color: TIPO_SEDE.tercerizada.color }}>Violeta</span> = tercerizada · <span style={{ color: TIPO_SEDE.costa.color }}>Rosa</span> = Costa Atlántica
      </p>
      <div className="flex flex-wrap gap-1 border-b p-2">
        {FILTROS.map(fl => (
          <button key={fl.key} type="button" onClick={() => setTipoF(fl.key)}
            className={`rounded-full border px-2 py-0.5 text-[11px] ${tipoF === fl.key ? 'border-primary bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent'}`}>
            {fl.label}
          </button>
        ))}
      </div>
      <div className="relative border-b p-2">
        <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Filtrar sedes…" value={q} onChange={e => setQ(e.target.value)} className="h-8 pl-7" />
      </div>
      <div className="flex-1 overflow-y-auto p-1.5">
        {lista.map((o, i) => {
          const activa = o.value === value;
          return (
            <div key={o.value} className={`flex items-center rounded-md transition-colors ${activa ? 'bg-primary/15 text-primary' : 'hover:bg-accent'}`}>
              <button type="button" onClick={() => onChange(o.value)}
                className={`flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left text-sm ${activa ? 'font-medium' : ''}`}>
                <SedeDot tipo={o.tipo} />
                <span className="flex-1 truncate">{o.label}</span>
                <span className={`text-xs tabular-nums ${activa ? 'text-primary' : 'text-muted-foreground'}`}>{o.count}</span>
              </button>
              {puedeEditarTipo && i > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="p-1.5 text-muted-foreground hover:text-foreground" aria-label="Tipo de sede">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {Object.entries(TIPO_SEDE).map(([k, v]) => (
                      <DropdownMenuItem key={k} onClick={() => onCambiarTipo(o.value, k)}>
                        <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full border" style={{ background: v.color || 'transparent' }} />
                        {v.label}{(o.tipo || 'propia') === k ? ' ✓' : ''}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
        {lista.length === 1 && (t || tipoF !== 'all') && <p className="px-2.5 py-2 text-xs text-muted-foreground">Ninguna sede coincide</p>}
      </div>
    </aside>
  );
}