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
        {[
          { label: 'Direcciones', value: stats.direcciones },
          { label: 'Escuelas', value: stats.escuelas },
          { label: 'Jefes Sitio', value: stats.jefesSitio },
          { label: 'Superficie', value: `${(stats.m2Total / 1000).toFixed(1)}K` },
        ].map((s, i) => (
          <div key={i} className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar dirección, jefe, inspector..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {comunas.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedComuna(selectedComuna === c.id ? 'all' : c.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                selectedComuna === c.id
                  ? c.color + ' shadow-md'
                  : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:border-slate-600/50'
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
          <div className="border border-dashed border-slate-700/50 rounded-lg py-12 text-center">
            <MapPin className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">Sin direcciones</p>
          </div>
        ) : (
          directorioCompleto.map(dir => (
            <div key={dir.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden hover:border-slate-600/50 transition-all">
              <button
                onClick={() => setExpandedDir(expandedDir === dir.id ? null : dir.id)}
                className="w-full text-left"
              >
                <div className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-5 w-5 text-orange-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white">{dir.direccion}</p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">
                        {dir.comuna}
                      </Badge>
                      {dir.jefe_sitio && (
                        <Badge className="bg-blue-500/20 text-blue-300 border-0 text-xs">
                          <Users className="h-2.5 w-2.5 mr-1" /> {dir.jefe_sitio}
                        </Badge>
                      )}
                      {dir.inspector && (
                        <Badge className="bg-purple-500/20 text-purple-300 border-0 text-xs">
                          {dir.inspector}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-lg font-bold text-white">{dir.escuelas.length}</p>
                      <p className="text-xs text-slate-400">escuelas</p>
                    </div>
                    {expandedDir === dir.id ? (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                </div>
              </button>

              {expandedDir === dir.id && (
                <div className="border-t border-slate-700/50 bg-slate-900/30 px-6 py-4 space-y-2">
                  {dir.escuelas.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4">Sin escuelas asignadas</p>
                  ) : (
                    dir.escuelas.map(esc => (
                      <div
                        key={esc.id}
                        className="bg-slate-800/80 rounded-lg p-3 border border-slate-700/50 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-white">{esc.establecimiento}</p>
                            <p className="text-slate-400 mt-1">{esc.ubic_tecnica}</p>
                          </div>
                          {esc.m2 > 0 && (
                            <div className="text-right flex-shrink-0">
                              <p className="font-bold text-white">{esc.m2}</p>
                              <p className="text-slate-400">m²</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}