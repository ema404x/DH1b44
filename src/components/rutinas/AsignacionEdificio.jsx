import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Building2, Search, Plus, RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { format, addDays } from 'date-fns';

export default function AsignacionEdificio() {
  const [edificioId, setEdificioId] = useState('');
  const [search, setSearch] = useState('');
  const [rubroFiltro, setRubroFiltro] = useState('all');
  const [newEdificio, setNewEdificio] = useState('');
  const [addingEdificio, setAddingEdificio] = useState(false);
  const qc = useQueryClient();

  const { data: edificios = [], isLoading: loadingEdificios } = useQuery({
    queryKey: ['edificios'],
    queryFn: () => base44.entities.Edificio.list('nombre', 200),
  });

  const { data: rutinas = [] } = useQuery({
    queryKey: ['rutinas-catalogo'],
    queryFn: () => base44.entities.RutinaCatalogo.list('rubro_nombre', 200),
    staleTime: 300_000,
  });

  const { data: asignaciones = [], isLoading: loadingAsig } = useQuery({
    queryKey: ['rutinas-edificio', edificioId],
    queryFn: () => edificioId
      ? base44.entities.RutinaEdificio.filter({ edificio_id: edificioId })
      : [],
    enabled: !!edificioId,
  });

  const rubros = useMemo(() => [...new Set(rutinas.map(r => r.rubro_nombre))].sort(), [rutinas]);

  const asigMap = useMemo(() => {
    const m = {};
    for (const a of asignaciones) m[a.rutina_id] = a;
    return m;
  }, [asignaciones]);

  const filteredRutinas = useMemo(() => rutinas.filter(r => {
    const matchRubro = rubroFiltro === 'all' || r.rubro_nombre === rubroFiltro;
    const q = search.toLowerCase();
    const matchSearch = !q || r.objeto?.toLowerCase().includes(q) || r.item?.toLowerCase().includes(q);
    return matchRubro && matchSearch;
  }), [rutinas, rubroFiltro, search]);

  const toggleMutation = useMutation({
    mutationFn: async ({ rutina, activa }) => {
      const edificio = edificios.find(e => e.id === edificioId);
      const existing = asigMap[rutina.id];
      if (existing) {
        await base44.entities.RutinaEdificio.update(existing.id, { activa });
      } else if (activa) {
        const hoy = new Date();
        const proxima = format(addDays(hoy, 1), 'yyyy-MM-dd');
        await base44.entities.RutinaEdificio.create({
          edificio_id: edificioId,
          edificio_nombre: edificio?.nombre || '',
          rutina_id: rutina.id,
          rutina_objeto: rutina.objeto,
          rubro_nombre: rutina.rubro_nombre,
          ciclo: rutina.ciclo,
          frecuencia_dias: rutina.frecuencia_dias,
          plazo_dias: rutina.plazo_dias,
          activa: true,
          proxima_ejecucion: proxima,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rutinas-edificio', edificioId] });
      toast.success('Asignación actualizada');
    },
    onError: () => toast.error('Error al actualizar'),
  });

  const crearEdificio = async () => {
    if (!newEdificio.trim()) return;
    setAddingEdificio(true);
    try {
      const e = await base44.entities.Edificio.create({ nombre: newEdificio.trim(), activo: true });
      qc.invalidateQueries({ queryKey: ['edificios'] });
      setEdificioId(e.id);
      setNewEdificio('');
      toast.success('Edificio creado');
    } finally {
      setAddingEdificio(false);
    }
  };

  const activasCount = asignaciones.filter(a => a.activa).length;

  return (
    <div className="space-y-5">
      {/* Selector de Edificio */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs uppercase tracking-wider font-semibold text-white/50 mb-3">Seleccionar Edificio</p>
        <div className="flex gap-3 flex-wrap">
          <Select value={edificioId} onValueChange={setEdificioId}>
            <SelectTrigger className="w-72 bg-white/5 border-white/15 text-white">
              <SelectValue placeholder="Elegir edificio…" />
            </SelectTrigger>
            <SelectContent>
              {edificios.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2 flex-1 min-w-56">
            <Input
              placeholder="Nuevo edificio…"
              value={newEdificio}
              onChange={e => setNewEdificio(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && crearEdificio()}
              className="bg-white/5 border-white/15 text-white placeholder:text-white/30"
            />
            <Button onClick={crearEdificio} disabled={addingEdificio || !newEdificio.trim()}
              className="shrink-0" style={{ background: '#D4AF37', color: '#0A2540' }}>
              {addingEdificio ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {edificioId && (
          <div className="flex items-center gap-3 mt-3 text-sm text-white/50">
            <Building2 className="h-4 w-4" />
            <span>{activasCount} de {rutinas.length} rutinas activas</span>
          </div>
        )}
      </div>

      {edificioId && (
        <>
          {/* Filtros */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <Input placeholder="Buscar rutina…" value={search} onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-white/5 border-white/15 text-white placeholder:text-white/30" />
            </div>
            <Select value={rubroFiltro} onValueChange={setRubroFiltro}>
              <SelectTrigger className="w-56 bg-white/5 border-white/15 text-white">
                <SelectValue placeholder="Rubro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los rubros</SelectItem>
                {rubros.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Tabla */}
          <div className="rounded-2xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10" style={{ background: 'rgba(212,175,55,0.08)' }}>
                    {['Rubro', 'Ítem', 'Rutina / Objeto', 'Ciclo', 'Plazo', 'Activa'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/50">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loadingAsig ? (
                    <tr><td colSpan={6} className="text-center py-12 text-white/40">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto" />
                    </td></tr>
                  ) : filteredRutinas.map(r => {
                    const asig = asigMap[r.id];
                    const activa = asig?.activa ?? false;
                    return (
                      <tr key={r.id} className={`transition-colors ${activa ? 'bg-white/3 hover:bg-white/5' : 'opacity-50 hover:opacity-80'}`}>
                        <td className="px-4 py-3 text-xs text-white/60">{r.rubro_nombre}</td>
                        <td className="px-4 py-3 text-xs text-white/60">{r.item}</td>
                        <td className="px-4 py-3 text-sm text-white font-medium">{r.objeto}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-[10px] text-white/60 border-white/20">{r.ciclo}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-white/50">{r.plazo_dias}d</td>
                        <td className="px-4 py-3">
                          <Switch
                            checked={activa}
                            onCheckedChange={v => toggleMutation.mutate({ rutina: r, activa: v })}
                            disabled={toggleMutation.isPending}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}