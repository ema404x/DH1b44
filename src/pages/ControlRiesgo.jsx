import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ShieldAlert, Filter, AlertTriangle, CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import RiesgoDetalle from '@/components/riesgo/RiesgoDetalle';
import RiesgoMatriz from '@/components/riesgo/RiesgoMatriz';

const NIVEL_CONFIG = {
  aceptable:  { label: 'Aceptable',  color: 'bg-emerald-100 text-emerald-800 border-emerald-300', dot: 'bg-emerald-500', max: 3 },
  tolerable:  { label: 'Tolerable',  color: 'bg-yellow-100 text-yellow-800 border-yellow-300',   dot: 'bg-yellow-400', min: 4,  max: 15 },
  alto:       { label: 'Alto',       color: 'bg-orange-100 text-orange-800 border-orange-300',    dot: 'bg-orange-500', min: 16, max: 31 },
  extremo:    { label: 'Extremo',    color: 'bg-red-100 text-red-800 border-red-300',             dot: 'bg-red-600',    min: 32 },
};

export function getNivelConfig(n) {
  if (n < 4)  return { key: 'aceptable', ...NIVEL_CONFIG.aceptable };
  if (n < 16) return { key: 'tolerable', ...NIVEL_CONFIG.tolerable };
  if (n < 32) return { key: 'alto',      ...NIVEL_CONFIG.alto };
  return { key: 'extremo', ...NIVEL_CONFIG.extremo };
}

const SECTORES = ['Todos', 'EDUCACION', 'SALUD', 'BAPRO'];
const NIVELES  = ['Todos', 'extremo', 'alto', 'tolerable', 'aceptable'];

export default function ControlRiesgo() {
  const [sector, setSector]   = useState('Todos');
  const [nivel, setNivel]     = useState('Todos');
  const [search, setSearch]   = useState('');
  const [selected, setSelected] = useState(null);
  const [view, setView]       = useState('lista'); // 'lista' | 'matriz'

  const { data: riesgos = [], isLoading } = useQuery({
    queryKey: ['riesgos-control'],
    queryFn: () => base44.entities.RiesgoControl.list('-nivel_riesgo', 200),
  });

  const filtered = riesgos.filter(r => {
    const nc = getNivelConfig(r.nivel_riesgo || 0);
    if (sector !== 'Todos' && r.sector !== sector) return false;
    if (nivel  !== 'Todos' && nc.key !== nivel)    return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.evento_riesgo?.toLowerCase().includes(q) &&
          !r.metodo_control?.toLowerCase().includes(q) &&
          !r.comentarios?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Stats
  const stats = riesgos.reduce((acc, r) => {
    const nc = getNivelConfig(r.nivel_riesgo || 0);
    acc[nc.key] = (acc[nc.key] || 0) + 1;
    return acc;
  }, {});

  if (selected) {
    return <RiesgoDetalle riesgo={selected} onClose={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-orange-500" />
            Control de Riesgos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Matriz de riesgos por sector — EDUCACION · SALUD · BAPRO</p>
        </div>
        <div className="flex gap-2">
          <Button variant={view === 'lista' ? 'default' : 'outline'} size="sm" onClick={() => setView('lista')}>
            Lista
          </Button>
          <Button variant={view === 'matriz' ? 'default' : 'outline'} size="sm" onClick={() => setView('matriz')}>
            Matriz
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: 'extremo',   label: 'Extremo',   icon: Zap,           color: 'text-red-600',    bg: 'bg-red-50 border-red-200' },
          { key: 'alto',      label: 'Alto',       icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
          { key: 'tolerable', label: 'Tolerable',  icon: AlertCircle,   color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
          { key: 'aceptable', label: 'Aceptable',  icon: CheckCircle2,  color: 'text-emerald-600',bg: 'bg-emerald-50 border-emerald-200' },
        ].map(({ key, label, icon: Icon, color, bg }) => (
          <div
            key={key}
            className={`rounded-xl border p-4 cursor-pointer transition-all ${bg} ${nivel === key ? 'ring-2 ring-offset-1 ring-primary' : 'hover:shadow-sm'}`}
            onClick={() => setNivel(nivel === key ? 'Todos' : key)}
          >
            <div className="flex items-center justify-between">
              <Icon className={`h-5 w-5 ${color}`} />
              <span className={`text-2xl font-bold ${color}`}>{stats[key] || 0}</span>
            </div>
            <p className={`text-xs font-semibold mt-1 ${color}`}>{label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar riesgo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <div className="flex gap-1">
          {SECTORES.map(s => (
            <Button key={s} size="sm" variant={sector === s ? 'default' : 'outline'}
              className="text-xs" onClick={() => setSector(s)}>
              {s}
            </Button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      {view === 'matriz' ? (
        <RiesgoMatriz riesgos={filtered} onSelect={setSelected} />
      ) : (
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-center py-16 text-muted-foreground">Cargando riesgos...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ShieldAlert className="h-10 w-10 mx-auto mb-2 opacity-20" />
              <p>No hay riesgos que coincidan con los filtros</p>
            </div>
          ) : filtered.map((r) => {
            const nc = getNivelConfig(r.nivel_riesgo || 0);
            return (
              <div
                key={r.id}
                onClick={() => setSelected(r)}
                className="bg-card border rounded-lg p-4 hover:shadow-sm hover:border-primary/20 transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${nc.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="outline" className={`text-[10px] border ${nc.color}`}>{nc.label}</Badge>
                      <Badge variant="outline" className="text-[10px]">{r.sector}</Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">N° {r.nivel_riesgo}</span>
                    </div>
                    <p className="text-sm font-medium leading-snug">{r.evento_riesgo}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 flex-wrap">
                      <span>P: <strong>{r.probabilidad}</strong></span>
                      <span>C: <strong>{r.consecuencia}</strong></span>
                      {r.frecuencia && <span>⏱ {r.frecuencia}</span>}
                    </div>
                    {r.metodo_control && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{r.metodo_control}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-center text-muted-foreground pt-2">{filtered.length} riesgos encontrados</p>
        </div>
      )}
    </div>
  );
}