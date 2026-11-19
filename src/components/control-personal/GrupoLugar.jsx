import React from 'react';
import { Building2 } from 'lucide-react';
import FichajeFila from './FichajeFila';

export default function GrupoLugar({ lugar, items }) {
  return (
    <div className="acero-rise rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-muted/20">
        <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <Building2 className="h-4 w-4 text-primary" />
        </div>
        <p className="text-sm font-semibold flex-1 min-w-0 truncate">{lugar}</p>
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">{items.length}</span>
      </div>
      <div className="divide-y divide-border/40">
        {items.map((f) => <FichajeFila key={f.id} f={f} />)}
      </div>
    </div>
  );
}