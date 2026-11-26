import React, { useState } from 'react';
import { ChevronsUpDown, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { normalizarTexto } from '@/components/assets/bapro/sedesBapro';
import { SedeDot } from '@/components/assets/bapro/tipoSede';

/** Selector de sede con buscador. options: [{ value, label, count? }]. */
export default function SedeBuscador({ options, value, onChange, placeholder = 'Elegir sede' }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const sel = options.find(o => o.value === value);
  const t = normalizarTexto(q);
  const lista = t ? options.filter(o => normalizarTexto(o.label).includes(t)) : options;

  const elegir = (v) => { onChange(v); setOpen(false); setQ(''); };

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm">
        <span className="truncate">{sel ? sel.label : placeholder}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover shadow-lg">
            <div className="border-b p-2">
              <Input autoFocus placeholder="Buscar sede…" value={q} onChange={e => setQ(e.target.value)} className="h-8" />
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {lista.map(o => (
                <button key={o.value} type="button" onClick={() => elegir(o.value)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent ${o.value === value ? 'text-primary font-medium' : ''}`}>
                  <Check className={`h-3.5 w-3.5 shrink-0 ${o.value === value ? 'opacity-100' : 'opacity-0'}`} />
                  <SedeDot tipo={o.tipo} />
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.count !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{o.count}</span>}
                </button>
              ))}
              {lista.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">Sin resultados</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}