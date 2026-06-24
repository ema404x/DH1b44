import React, { useMemo, useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export const fmt  = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
export const fmtM = (n) => { if (!n) return '$0'; const a = Math.abs(n); if (a >= 1e6) return `$${(n/1e6).toFixed(1)}M`; if (a >= 1000) return `$${(n/1000).toFixed(0)}K`; return `$${n}`; };
export const pct = (n, d = 0) => `${(n || 0).toFixed(d)}%`;

// ── Custom chart tooltip ────────────────────────────────────────────────────
export function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border/60 rounded-xl px-3 py-2.5 shadow-xl text-xs max-w-[200px]">
      <p className="font-semibold text-foreground mb-1.5 truncate">{label}</p>
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full shrink-0" style={{ background: p.stroke || p.fill }} />
              <span className="text-muted-foreground">{p.name}</span>
            </div>
            <span className="font-bold text-foreground tabular-nums">{fmt(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Premium KPI card with background icon + delta chip ───────────────────────
export function KpiCard({ label, value, sub, icon: Icon, accent = 'primary', delta }) {
  const accents = {
    primary:  { ring: 'border-primary/15',       glow: 'bg-primary/8',       text: 'text-primary',     hex: 'hsl(213,90%,55%)'     },
    emerald:  { ring: 'border-emerald-500/15',   glow: 'bg-emerald-500/8',   text: 'text-emerald-400',  hex: '#34d399'              },
    amber:    { ring: 'border-amber-500/15',     glow: 'bg-amber-500/8',     text: 'text-amber-400',    hex: '#fbbf24'              },
    purple:   { ring: 'border-purple-500/15',    glow: 'bg-purple-500/8',    text: 'text-purple-400',  hex: '#c084fc'              },
    blue:     { ring: 'border-blue-500/15',      glow: 'bg-blue-500/8',      text: 'text-blue-400',    hex: '#60a5fa'              },
    red:      { ring: 'border-red-500/15',       glow: 'bg-red-500/8',       text: 'text-red-400',     hex: '#f87171'              },
  };
  const a = accents[accent] || accents.primary;
  const DeltaIcon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : null;
  const deltaCls  = delta > 0 ? 'text-emerald-400 bg-emerald-500/10' : delta < 0 ? 'text-red-400 bg-red-500/10' : 'text-muted-foreground bg-muted/30';

  return (
    <div className={`relative rounded-2xl border ${a.ring} bg-card p-4 overflow-hidden group transition-all hover:border-border/60`}>
      <div className={`absolute inset-0 ${a.glow} opacity-50 pointer-events-none`} />
      <div className="absolute -right-3 -top-3 opacity-[0.06] group-hover:opacity-[0.1] transition-opacity">
        {Icon && <Icon className="h-16 w-16" style={{ color: a.hex }} strokeWidth={1.5} />}
      </div>
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
          {delta !== undefined && delta !== 0 && DeltaIcon && (
            <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${deltaCls}`}>
              <DeltaIcon className="h-2.5 w-2.5" />
              {Math.abs(delta)}%
            </span>
          )}
        </div>
        <p className={`text-[1.6rem] font-bold tabular-nums leading-none ${a.text}`}>{value}</p>
        <p className="text-[11px] text-muted-foreground mt-1.5">{sub}</p>
      </div>
    </div>
  );
}

// ── Skeleton for loading state ───────────────────────────────────────────────
export function TableSkeleton({ rows = 8, cols = 6 }) {
  return (
    <div className="rounded-2xl border border-border/30 bg-card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border/20">
        <div className="h-3 w-32 skeleton rounded" />
      </div>
      <div className="divide-y divide-border/10">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center px-4 py-3 gap-3">
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className="h-3 skeleton rounded flex-1" style={{ maxWidth: c < 2 ? '25%' : '15%' }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function KpiSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border/30 bg-card p-4">
          <div className="h-2.5 w-20 skeleton rounded mb-3" />
          <div className="h-7 w-28 skeleton rounded mb-2" />
          <div className="h-2.5 w-16 skeleton rounded" />
        </div>
      ))}
    </div>
  );
}

// ── Sortable header cell ─────────────────────────────────────────────────────
export function SortableTh({ label, sortKey, currentSort, onSort, align = 'left', className = '' }) {
  const active = currentSort.key === sortKey;
  const DirIcon = active ? (currentSort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} ${className}`}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''} ${active ? 'text-foreground' : ''}`}>
        {label}
        <DirIcon className={`h-3 w-3 ${active ? 'opacity-100' : 'opacity-30'}`} />
      </span>
    </th>
  );
}

// ── Hook: sort state + sorted data ───────────────────────────────────────────
export function useTableSort(data, defaultKey = null, defaultDir = 'desc') {
  const [sort, setSort] = useState({ key: defaultKey, dir: defaultDir });
  const onSort = (key) =>
    setSort(prev => ({ key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc' }));
  const sorted = useMemo(() => {
    if (!sort.key) return data;
    const dirMul = sort.dir === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dirMul;
      return String(av ?? '').localeCompare(String(bv ?? '')) * dirMul;
    });
  }, [data, sort]);
  return { sort, onSort, sorted };
}