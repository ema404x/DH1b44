import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search, Wrench, Users, MapPin, Plus, Edit2, Check, X,
  AlertTriangle, CheckCircle2, Clock, Package, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import { isPast, parseISO, differenceInDays } from 'date-fns';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const TYPE_LABELS = {
  equipo_electrico: 'Eléctrico',
  equipo_mecanico: 'Mecánico',
  instalacion_hvac: 'HVAC',
  instalacion_sanitaria: 'Sanitaria',
  estructura: 'Estructura',
  vehiculo: 'Vehículo',
  herramienta: 'Herramienta',
  sistemas_informaticos: 'Sistemas',
  mobiliario: 'Mobiliario',
  seguridad: 'Seguridad',
  otro: 'Otro',
};

const STATUS_COLORS = {
  operativo: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  en_mantenimiento: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  fuera_de_servicio: 'bg-red-500/20 text-red-300 border-red-500/30',
  baja: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const CRIT_COLORS = {
  critica: 'bg-red-500/20 text-red-300',
  alta: 'bg-orange-500/20 text-orange-300',
  media: 'bg-blue-500/20 text-blue-300',
  baja: 'bg-slate-500/20 text-slate-400',
};

export default function AssetDirectory() {
  const { isAdmin } = useCurrentUser();
  const [search, setSearch] = useState('');
  const [filterArea, setFilterArea] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedSede, setExpandedSede] = useState(null);
  const [editingJefe, setEditingJefe] = useState(null);
  const [jefeValue, setJefeValue] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newAsset, setNewAsset] = useState({ name: '', type: 'otro', sede: '', area: '', location: '', serial_number: '', brand: '', model: '' });
  const queryClient = useQueryClient();

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: () => base44.entities.Asset.list('-updated_date', 500),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date', 200),
    staleTime: 120000,
  });

  const jefesOptions = useMemo(() => {
    const names = employees
      .filter(e => e.role && (e.role.toLowerCase().includes('jefe') || e.role.toLowerCase().includes('supervisor')))
      .map(e => e.full_name)
      .filter(Boolean);
    return [...new Set(names)].sort();
  }, [employees]);

  const areas = useMemo(() => {
    const set = new Set(assets.map(a => a.area).filter(Boolean));
    return [...set].sort();
  }, [assets]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => base44.entities.Asset.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setEditingJefe(null);
      setJefeValue('');
      toast.success('Activo actualizado');
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data) => base44.entities.Asset.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Activo creado');
      setShowCreate(false);
      setNewAsset({ name: '', type: 'otro', sede: '', area: '', location: '', serial_number: '', brand: '', model: '' });
    },
    onError: (e) => toast.error('Error: ' + (e.message || '')),
  });

  // Agrupar por sede
  const grouped = useMemo(() => {
    let filtered = assets;
    if (filterArea !== 'all') filtered = filtered.filter(a => a.area === filterArea);
    if (filterStatus !== 'all') filtered = filtered.filter(a => a.status === filterStatus);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(a =>
        a.name?.toLowerCase().includes(q) ||
        a.code?.toLowerCase().includes(q) ||
        a.serial_number?.toLowerCase().includes(q) ||
        a.sede?.toLowerCase().includes(q) ||
        a.jefe_sitio?.toLowerCase().includes(q) ||
        a.location?.toLowerCase().includes(q)
      );
    }

    const mapa = {};
    filtered.forEach(a => {
      const key = a.sede || 'Sin sede';
      if (!mapa[key]) mapa[key] = [];
      mapa[key].push(a);
    });
    return Object.entries(mapa).map(([sede, items]) => ({ sede, items }));
  }, [assets, search, filterArea, filterStatus]);

  const stats = useMemo(() => {
    const operativos = assets.filter(a => a.status === 'operativo').length;
    const enMant = assets.filter(a => a.status === 'en_mantenimiento').length;
    const fueraServ = assets.filter(a => a.status === 'fuera_de_servicio').length;
    const overdue = assets.filter(a => {
      try { return a.next_maintenance && isPast(parseISO(a.next_maintenance)) && a.status !== 'baja'; }
      catch { return false; }
    }).length;
    const jefesCount = new Set(assets.map(a => a.jefe_sitio).filter(Boolean)).size;
    return { total: assets.length, operativos, enMant, fueraServ, overdue, jefesCount };
  }, [assets]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Activos', value: stats.total, icon: Package, color: 'text-blue-300' },
          { label: 'Operativos', value: stats.operativos, icon: CheckCircle2, color: 'text-emerald-300' },
          { label: 'En Mant.', value: stats.enMant, icon: Wrench, color: 'text-blue-300' },
          { label: 'Vencidos', value: stats.overdue, icon: AlertTriangle, color: 'text-red-300', highlight: stats.overdue > 0 },
        ].map((s, i) => (
          <div key={i} className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-400">{s.label}</p>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className={`text-2xl font-bold ${s.highlight ? 'text-red-300' : 'text-white'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros + Crear */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar activo, código, serie, sede..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500"
          />
        </div>
        {areas.length > 0 && (
          <select
            value={filterArea}
            onChange={e => setFilterArea(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-white text-sm"
          >
            <option value="all">Todas las áreas</option>
            {areas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-white text-sm"
        >
          <option value="all">Todos los estados</option>
          <option value="operativo">Operativo</option>
          <option value="en_mantenimiento">En mantenimiento</option>
          <option value="fuera_de_servicio">Fuera de servicio</option>
          <option value="baja">Baja</option>
        </select>
        {isAdmin && (
          <Button onClick={() => setShowCreate(s => !s)} size="sm">
            <Plus className="h-4 w-4" /> Nuevo Activo
          </Button>
        )}
      </div>

      {/* Formulario crear */}
      {showCreate && isAdmin && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Nombre *</label>
              <Input value={newAsset.name} onChange={e => setNewAsset({...newAsset, name: e.target.value})} className="bg-slate-900/50 border-slate-700/50 text-white" placeholder="Ej: CAI Central 01" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Tipo</label>
              <select value={newAsset.type} onChange={e => setNewAsset({...newAsset, type: e.target.value})} className="w-full h-9 px-3 rounded-md bg-slate-900/50 border border-slate-700/50 text-white text-sm">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Sede</label>
              <Input value={newAsset.sede} onChange={e => setNewAsset({...newAsset, sede: e.target.value})} className="bg-slate-900/50 border-slate-700/50 text-white" placeholder="Ej: Casa Central" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Área</label>
              <Input value={newAsset.area} onChange={e => setNewAsset({...newAsset, area: e.target.value})} className="bg-slate-900/50 border-slate-700/50 text-white" placeholder="Ej: Tesorería" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Ubicación</label>
              <Input value={newAsset.location} onChange={e => setNewAsset({...newAsset, location: e.target.value})} className="bg-slate-900/50 border-slate-700/50 text-white" placeholder="Piso, oficina..." />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">N° de Serie</label>
              <Input value={newAsset.serial_number} onChange={e => setNewAsset({...newAsset, serial_number: e.target.value})} className="bg-slate-900/50 border-slate-700/50 text-white" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Marca</label>
              <Input value={newAsset.brand} onChange={e => setNewAsset({...newAsset, brand: e.target.value})} className="bg-slate-900/50 border-slate-700/50 text-white" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Modelo</label>
              <Input value={newAsset.model} onChange={e => setNewAsset({...newAsset, model: e.target.value})} className="bg-slate-900/50 border-slate-700/50 text-white" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => {
                if (!newAsset.name.trim()) { toast.error('El nombre es obligatorio'); return; }
                createMutation.mutate(newAsset);
              }}
              disabled={createMutation.isPending}
              size="sm"
            >
              {createMutation.isPending ? 'Creando...' : 'Crear Activo'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Directorio agrupado por sede */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-2 border-slate-700 border-t-primary rounded-full" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="border border-dashed border-slate-700/50 rounded-lg py-12 text-center">
          <Package className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Sin activos registrados</p>
          {isAdmin && <p className="text-xs text-slate-500 mt-1">Creá el primer activo con el botón "Nuevo Activo"</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {grouped.map(({ sede, items }) => (
            <div key={sede} className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden hover:border-slate-600/50 transition-all">
              <button
                onClick={() => setExpandedSede(expandedSede === sede ? null : sede)}
                className="w-full text-left"
              >
                <div className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white">{sede}</p>
                    <div className="flex gap-2 mt-1 flex-wrap items-center">
                      <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">
                        {items.length} activo{items.length !== 1 ? 's' : ''}
                      </Badge>
                      {items.filter(a => a.status === 'fuera_de_servicio').length > 0 && (
                        <Badge className="bg-red-500/20 text-red-300 border-0 text-xs">
                          {items.filter(a => a.status === 'fuera_de_servicio').length} fuera servicio
                        </Badge>
                      )}
                      {items.filter(a => { try { return a.next_maintenance && isPast(parseISO(a.next_maintenance)) && a.status !== 'baja'; } catch { return false; } }).length > 0 && (
                        <Badge className="bg-orange-500/20 text-orange-300 border-0 text-xs">
                          <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                          {items.filter(a => { try { return a.next_maintenance && isPast(parseISO(a.next_maintenance)) && a.status !== 'baja'; } catch { return false; } }).length} mant. vencido
                        </Badge>
                      )}
                    </div>
                  </div>
                  {expandedSede === sede ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                </div>
              </button>

              {expandedSede === sede && (
                <div className="border-t border-slate-700/50 bg-slate-900/30 px-4 py-3 space-y-2">
                  {items.map(a => {
                    const overdue = (() => { try { return a.next_maintenance && isPast(parseISO(a.next_maintenance)) && a.status !== 'baja'; } catch { return false; } })();
                    const daysToMant = a.next_maintenance ? differenceInDays(parseISO(a.next_maintenance), new Date()) : null;
                    return (
                      <div key={a.id} className="bg-slate-800/80 rounded-lg p-3 border border-slate-700/50">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-white text-sm">{a.name}</p>
                              <Badge className={`text-[10px] border-0 ${STATUS_COLORS[a.status] || STATUS_COLORS.operativo}`}>
                                {a.status?.replace(/_/g, ' ')}
                              </Badge>
                              <Badge className={`text-[10px] border-0 ${CRIT_COLORS[a.criticality] || CRIT_COLORS.media}`}>
                                {a.criticality}
                              </Badge>
                            </div>
                            <div className="flex gap-3 mt-1.5 flex-wrap text-xs text-slate-400">
                              {a.code && <span className="font-mono">{a.code}</span>}
                              <span>{TYPE_LABELS[a.type] || a.type}</span>
                              {a.brand && <span>{a.brand} {a.model}</span>}
                              {a.serial_number && <span className="font-mono">S/N: {a.serial_number}</span>}
                              {a.location && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{a.location}</span>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            {overdue ? (
                              <Badge className="bg-red-500/20 text-red-300 border-0 text-xs">
                                <AlertTriangle className="h-2.5 w-2.5 mr-1" /> Vencido
                              </Badge>
                            ) : daysToMant !== null && daysToMant <= 30 ? (
                              <Badge className="bg-amber-500/20 text-amber-300 border-0 text-xs">
                                <Clock className="h-2.5 w-2.5 mr-1" /> {daysToMant}d
                              </Badge>
                            ) : daysToMant !== null && daysToMant > 0 ? (
                              <Badge className="bg-slate-700/50 text-slate-400 border-0 text-xs">
                                <Clock className="h-2.5 w-2.5 mr-1" /> {daysToMant}d
                              </Badge>
                            ) : null}
                          </div>
                        </div>

                        {/* Jefe de sitio asignable */}
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-700/50">
                          {editingJefe === a.id ? (
                            <>
                              {jefesOptions.length > 0 ? (
                                <select
                                  autoFocus
                                  value={jefeValue}
                                  onChange={e => setJefeValue(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') updateMutation.mutate({ id: a.id, data: { jefe_sitio: jefeValue } });
                                    if (e.key === 'Escape') { setEditingJefe(null); setJefeValue(''); }
                                  }}
                                  className="bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-xs text-white outline-none focus:border-primary/50"
                                >
                                  <option value="">Seleccionar...</option>
                                  {jefesOptions.map(j => <option key={j} value={j}>{j}</option>)}
                                </select>
                              ) : (
                                <input
                                  autoFocus
                                  value={jefeValue}
                                  onChange={e => setJefeValue(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') updateMutation.mutate({ id: a.id, data: { jefe_sitio: jefeValue } });
                                    if (e.key === 'Escape') { setEditingJefe(null); setJefeValue(''); }
                                  }}
                                  className="bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-xs text-white w-40 outline-none focus:border-primary/50"
                                  placeholder="Nombre responsable..."
                                />
                              )}
                              <button onClick={() => updateMutation.mutate({ id: a.id, data: { jefe_sitio: jefeValue } })} className="text-emerald-400 hover:text-emerald-300"><Check className="h-3.5 w-3.5" /></button>
                              <button onClick={() => { setEditingJefe(null); setJefeValue(''); }} className="text-slate-400 hover:text-slate-300"><X className="h-3.5 w-3.5" /></button>
                            </>
                          ) : (
                            <span
                              onClick={() => { if (isAdmin) { setEditingJefe(a.id); setJefeValue(a.jefe_sitio || ''); } }}
                              className={`text-xs ${isAdmin ? 'cursor-pointer' : ''}`}
                            >
                              {a.jefe_sitio ? (
                                <Badge className="bg-blue-500/20 text-blue-300 border-0 text-xs">
                                  <Users className="h-2.5 w-2.5 mr-1" />{a.jefe_sitio}
                                </Badge>
                              ) : (
                                <Badge className="bg-slate-700/50 text-slate-500 border border-dashed border-slate-600 text-xs hover:border-slate-500 hover:text-slate-400">
                                  + Asignar responsable
                                </Badge>
                              )}
                            </span>
                          )}
                          {a.area && <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">{a.area}</Badge>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}