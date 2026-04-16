import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Upload, Search, Filter, MapPin, Users, Building2, FileText,
  ChevronDown, ChevronUp, Download, Settings, Zap, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import ImportadorLocations from '@/components/informacion-general/ImportadorLocations';
import JefeSitioPanel from '@/components/informacion-general/JefeSitioPanel';
import LocationsGrid from '@/components/informacion-general/LocationsGrid';

const COMUNAS = [
  { id: '8A', label: 'Comuna 8A', color: 'bg-blue-100 text-blue-700' },
  { id: '8B', label: 'Comuna 8B', color: 'bg-purple-100 text-purple-700' },
  { id: '10A', label: 'Comuna 10A', color: 'bg-emerald-100 text-emerald-700' },
];

export default function InformacionGeneral() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [selectedComuna, setSelectedComuna] = useState('all');
  const [selectedJefe, setSelectedJefe] = useState('all');
  const [expandedJefe, setExpandedJefe] = useState(null);

  const { data: locations = [], isLoading, refetch } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.LocationData.list('-created_date', 500),
  });

  // Agrupar datos por jefe de sitio y comuna
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

    // Agrupar por jefe de sitio
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
  }, [locations, search, selectedComuna, selectedJefe]);

  const stats = useMemo(() => ({
    total: locations.length,
    activos: locations.filter(l => l.estado === 'activo').length,
    jefesSitio: new Set(locations.map(l => l.jefe_sitio).filter(Boolean)).size,
    m2Total: locations.reduce((s, l) => s + (l.m2 || 0), 0),
  }), [locations]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                <Building2 className="h-8 w-8 text-primary" />
                Información General
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Administra escuelas, jefes de sitio y flujos de trabajo</p>
            </div>
            <div className="flex gap-2">
              {activeTab === 'dashboard' && (
                <Button
                  onClick={() => setActiveTab('import')}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" /> Importar Datos
                </Button>
              )}
              {activeTab === 'import' && (
                <Button
                  variant="outline"
                  onClick={() => setActiveTab('dashboard')}
                >
                  Ver Dashboard
                </Button>
              )}
            </div>
          </div>

          {/* Tabs */}
          {activeTab === 'dashboard' && (
            <div className="flex gap-2 border-b border-slate-200 -mb-4">
              {[
                { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
                { key: 'locations', label: 'Escuelas', icon: Building2 },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
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
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Escuelas', value: stats.total, icon: Building2, color: 'bg-blue-100 text-blue-700' },
              { label: 'Activas', value: stats.activos, icon: Zap, color: 'bg-emerald-100 text-emerald-700' },
              { label: 'Jefes de Sitio', value: stats.jefesSitio, icon: Users, color: 'bg-purple-100 text-purple-700' },
              { label: 'Superficie Total (m²)', value: `${stats.m2Total.toFixed(0)}`, icon: MapPin, color: 'bg-orange-100 text-orange-700' },
            ].map((stat, idx) => (
              <Card key={idx} className="border-0 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                      <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
                    </div>
                    <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${stat.color}`}>
                      <stat.icon className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
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
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    selectedComuna === c.id
                      ? c.color
                      : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {c.label}
                </button>
              ))}
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
    </div>
  );
}