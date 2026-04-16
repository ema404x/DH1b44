import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Upload, Search, Filter, MapPin, Users, Building2, FileText,
  ChevronDown, ChevronUp, Download, Settings, Zap, BarChart3,
  Edit2, Save, X, TrendingUp, Map, FileJson, FileSpreadsheet
} from 'lucide-react';
import { toast } from 'sonner';
import ImportadorLocations from '@/components/informacion-general/ImportadorLocations';
import JefeSitioPanel from '@/components/informacion-general/JefeSitioPanel';
import LocationsGrid from '@/components/informacion-general/LocationsGrid';
import EstadisticasAvanzadas from '@/components/informacion-general/EstadisticasAvanzadas';
import ExportadorDatos from '@/components/informacion-general/ExportadorDatos';

const COMUNAS = [
  { id: '8A', label: 'Comuna 8A', color: 'bg-blue-100 text-blue-700' },
  { id: '8B', label: 'Comuna 8B', color: 'bg-purple-100 text-purple-700' },
  { id: '10A', label: 'Comuna 10A', color: 'bg-emerald-100 text-emerald-700' },
];

export default function InformacionGeneral() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [selectedComuna, setSelectedComuna] = useState('all');
  const [expandedJefe, setExpandedJefe] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const queryClient = useQueryClient();

  const { data: locations = [], isLoading, refetch } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.LocationData.list('-created_date', 500),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.LocationData.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setEditingId(null);
      toast.success('Escuela actualizada');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.LocationData.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast.success('Escuela eliminada');
    },
  });

  // Filtrado y organización de datos
  const organizados = useMemo(() => {
    let filtered = locations;

    if (selectedComuna !== 'all') {
      filtered = filtered.filter(l => l.comuna === selectedComuna);
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(l =>
        l.establecimiento?.toLowerCase().includes(q) ||
        l.direccion?.toLowerCase().includes(q) ||
        l.ubic_tecnica?.toLowerCase().includes(q) ||
        l.jefe_sitio?.toLowerCase().includes(q)
      );
    }

    const byJefe = {};
    filtered.forEach(loc => {
      const jefe = loc.jefe_sitio || 'Sin asignar';
      if (!byJefe[jefe]) {
        byJefe[jefe] = {
          nombre: jefe,
          comunas: {},
          locations: [],
        };
      }
      byJefe[jefe].locations.push(loc);

      const comuna = loc.comuna || 'Otra';
      if (!byJefe[jefe].comunas[comuna]) {
        byJefe[jefe].comunas[comuna] = [];
      }
      byJefe[jefe].comunas[comuna].push(loc);
    });

    return Object.values(byJefe).sort((a, b) => b.locations.length - a.locations.length);
  }, [locations, search, selectedComuna]);

  const stats = useMemo(() => ({
    total: locations.length,
    activos: locations.filter(l => l.estado === 'activo').length,
    inactivos: locations.filter(l => l.estado === 'inactivo').length,
    jefesSitio: new Set(locations.map(l => l.jefe_sitio).filter(Boolean)).size,
    m2Total: locations.reduce((s, l) => s + (l.m2 || 0), 0),
    sup: locations.reduce((s, l) => s + (l.sup || 0), 0),
    comunas: COMUNAS.map(c => ({
      id: c.id,
      label: c.label,
      count: locations.filter(l => l.comuna === c.id).length,
    })),
  }), [locations]);

  const handleEdit = (loc) => {
    setEditingId(loc.id);
    setEditForm(loc);
  };

  const handleSave = async () => {
    await updateMutation.mutate({ id: editingId, data: editForm });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header Mejorado */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                Información General
              </h1>
              <p className="text-sm text-muted-foreground mt-2">Administra escuelas, jefes de sitio, datos y reportes</p>
            </div>
            <div className="flex gap-2">
              {activeTab === 'dashboard' && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab('reportes')}
                    className="gap-2"
                  >
                    <TrendingUp className="h-4 w-4" /> Reportes
                  </Button>
                  <Button
                    onClick={() => setActiveTab('import')}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" /> Importar
                  </Button>
                </>
              )}
              {activeTab !== 'dashboard' && (
                <Button
                  variant="outline"
                  onClick={() => setActiveTab('dashboard')}
                >
                  Volver
                </Button>
              )}
            </div>
          </div>

          {/* Tabs */}
          {activeTab !== 'import' && (
            <div className="flex gap-2 border-b border-slate-200 -mb-6 overflow-x-auto">
              {[
                { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
                { key: 'locations', label: 'Escuelas', icon: Building2 },
                { key: 'mapa', label: 'Mapa', icon: Map },
                { key: 'reportes', label: 'Reportes', icon: TrendingUp },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="max-w-7xl mx-auto px-6 py-8">
          <ImportadorLocations onImportSuccess={() => { refetch(); setActiveTab('dashboard'); }} />
        </div>
      )}

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          {/* Stats Cards Mejorados */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Total Escuelas', value: stats.total, icon: Building2, color: 'from-blue-500 to-blue-600', trend: '+2.5%' },
              { label: 'Activas', value: stats.activos, icon: Zap, color: 'from-emerald-500 to-emerald-600', trend: '+1.2%' },
              { label: 'Inactivas', value: stats.inactivos, icon: Filter, color: 'from-slate-500 to-slate-600' },
              { label: 'Jefes de Sitio', value: stats.jefesSitio, icon: Users, color: 'from-purple-500 to-purple-600' },
              { label: 'Superficie (m²)', value: `${(stats.m2Total / 1000).toFixed(1)}K`, icon: MapPin, color: 'from-orange-500 to-orange-600' },
            ].map((stat, idx) => (
              <Card key={idx} className="border-0 shadow-md hover:shadow-lg transition-shadow overflow-hidden">
                <div className={`h-1.5 w-full bg-gradient-to-r ${stat.color}`} />
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">{stat.label}</p>
                      <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
                      {stat.trend && <p className="text-xs text-emerald-600 mt-1">{stat.trend}</p>}
                    </div>
                    <div className={`h-12 w-12 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center text-white`}>
                      <stat.icon className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Estadísticas por Comuna */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {stats.comunas.map(c => (
              <Card key={c.id} className="border-0 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{c.label}</p>
                      <p className="text-2xl font-bold text-slate-900">{c.count}</p>
                    </div>
                    <Badge className={COMUNAS.find(x => x.id === c.id)?.color}>
                      {((c.count / stats.total) * 100).toFixed(0)}%
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filtros Mejorados */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar escuela, jefe, dirección..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              {COMUNAS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedComuna(selectedComuna === c.id ? 'all' : c.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedComuna === c.id
                      ? c.color + ' shadow-md'
                      : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {c.label} ({stats.comunas.find(x => x.id === c.id)?.count || 0})
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <ExportadorDatos locations={locations.filter(l => {
                const matchSearch = !search || 
                  l.establecimiento?.toLowerCase().includes(search.toLowerCase()) ||
                  l.direccion?.toLowerCase().includes(search.toLowerCase());
                const matchComuna = selectedComuna === 'all' || l.comuna === selectedComuna;
                return matchSearch && matchComuna;
              })} />
            </div>
          </div>

          {/* Jefes de Sitio Accordion */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-slate-200 border-t-primary rounded-full" />
            </div>
          ) : organizados.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">Sin resultados</p>
                <p className="text-sm text-muted-foreground mt-1">Importa datos o ajusta los filtros</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {organizados.map(jefeData => (
                <JefeSitioPanel
                  key={jefeData.nombre}
                  jefeData={jefeData}
                  isExpanded={expandedJefe === jefeData.nombre}
                  onToggle={() => setExpandedJefe(expandedJefe === jefeData.nombre ? null : jefeData.nombre)}
                  comunas={COMUNAS}
                  onEdit={handleEdit}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Locations Grid Tab */}
      {activeTab === 'locations' && (
        <div className="max-w-7xl mx-auto px-6 py-8">
          <LocationsGrid locations={locations} isLoading={isLoading} />
        </div>
      )}

      {/* Reportes Tab */}
      {activeTab === 'reportes' && (
        <div className="max-w-7xl mx-auto px-6 py-8">
          <EstadisticasAvanzadas locations={locations} comunas={COMUNAS} />
        </div>
      )}
    </div>
  );
}