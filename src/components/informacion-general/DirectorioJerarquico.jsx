import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown, ChevronUp, MapPin, Users, Building2, Edit2, Trash2, Plus,
  Search, Filter
} from 'lucide-react';
import { toast } from 'sonner';

export default function DirectorioJerarquico() {
  const [search, setSearch] = useState('');
  const [selectedComuna, setSelectedComuna] = useState('all');
  const [expandedDir, setExpandedDir] = useState(null);
  const queryClient = useQueryClient();

  const { data: direcciones = [] } = useQuery({
    queryKey: ['direcciones'],
    queryFn: () => base44.entities.Direccion.list('-updated_date', 500),
  });

  const { data: escuelas = [] } = useQuery({
    queryKey: ['escuelas'],
    queryFn: () => base44.entities.LocationData.list('-updated_date', 500),
  });

  // Mapear escuelas por dirección
  const directorioCompleto = useMemo(() => {
    const mapa = {};
    
    escuelas.forEach(esc => {
      if (esc.direccion_id) {
        if (!mapa[esc.direccion_id]) {
          mapa[esc.direccion_id] = [];
        }
        mapa[esc.direccion_id].push(esc);
      }
    });

    let filtered = direcciones;
    if (selectedComuna !== 'all') {
      filtered = filtered.filter(d => d.comuna === selectedComuna);
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(d =>
        d.direccion?.toLowerCase().includes(q) ||
        d.jefe_sitio?.toLowerCase().includes(q) ||
        d.inspector?.toLowerCase().includes(q)
      );
    }

    return filtered.map(dir => ({
      ...dir,
      escuelas: mapa[dir.id] || [],
    }));
  }, [direcciones, escuelas, search, selectedComuna]);

  const stats = useMemo(() => ({
    direcciones: direcciones.length,
    escuelas: escuelas.length,
    jefesSitio: new Set(direcciones.map(d => d.jefe_sitio).filter(Boolean)).size,
    inspectores: new Set(direcciones.map(d => d.inspector).filter(Boolean)).size,
    m2Total: direcciones.reduce((s, d) => s + (d.m2 || 0), 0),
  }), [direcciones, escuelas]);

  const comunas = [
    { id: '8A', label: 'Comuna 8A', color: 'bg-blue-100 text-blue-700' },
    { id: '8B', label: 'Comuna 8B', color: 'bg-purple-100 text-purple-700' },
    { id: '10A', label: 'Comuna 10A', color: 'bg-emerald-100 text-emerald-700' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Direcciones</p>
            <p className="text-2xl font-bold">{stats.direcciones}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Escuelas</p>
            <p className="text-2xl font-bold">{stats.escuelas}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Jefes Sitio</p>
            <p className="text-2xl font-bold">{stats.jefesSitio}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Superficie</p>
            <p className="text-2xl font-bold">{(stats.m2Total / 1000).toFixed(1)}K</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar dirección, jefe, inspector..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {comunas.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedComuna(selectedComuna === c.id ? 'all' : c.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedComuna === c.id
                  ? c.color + ' shadow-md'
                  : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Directorio */}
      <div className="space-y-2">
        {directorioCompleto.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <MapPin className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">Sin direcciones</p>
            </CardContent>
          </Card>
        ) : (
          directorioCompleto.map(dir => (
            <Card key={dir.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <button
                onClick={() => setExpandedDir(expandedDir === dir.id ? null : dir.id)}
                className="w-full text-left"
              >
                <CardContent className="pt-4 pb-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-5 w-5 text-orange-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900">{dir.direccion}</p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {dir.comuna}
                      </Badge>
                      {dir.jefe_sitio && (
                        <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">
                          <Users className="h-2.5 w-2.5 mr-1" /> {dir.jefe_sitio}
                        </Badge>
                      )}
                      {dir.inspector && (
                        <Badge className="bg-purple-100 text-purple-700 border-0 text-xs">
                          {dir.inspector}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-900">{dir.escuelas.length}</p>
                      <p className="text-xs text-muted-foreground">escuelas</p>
                    </div>
                    {expandedDir === dir.id ? (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                </CardContent>
              </button>

              {expandedDir === dir.id && (
                <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4 space-y-2">
                  {dir.escuelas.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4">Sin escuelas asignadas</p>
                  ) : (
                    dir.escuelas.map(esc => (
                      <div
                        key={esc.id}
                        className="bg-white rounded-lg p-3 border border-slate-200 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-slate-900">{esc.establecimiento}</p>
                            <p className="text-muted-foreground mt-1">{esc.ubic_tecnica}</p>
                          </div>
                          {esc.m2 > 0 && (
                            <div className="text-right flex-shrink-0">
                              <p className="font-bold text-slate-900">{esc.m2}</p>
                              <p className="text-muted-foreground">m²</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}