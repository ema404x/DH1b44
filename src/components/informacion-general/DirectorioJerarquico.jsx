import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown, ChevronUp, MapPin, Users, Building2, Edit2, Check, X,
  Search, UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { Input as InputUI } from '@/components/ui/input';

export default function DirectorioJerarquico() {
  const [search, setSearch] = useState('');
  const [selectedComuna, setSelectedComuna] = useState('all');
  const [expandedDir, setExpandedDir] = useState(null);
  const [editingInspector, setEditingInspector] = useState(null); // id de dirección en edición
  const [inspectorValue, setInspectorValue] = useState('');
  const queryClient = useQueryClient();

  const updateDireccionMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Direccion.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['direcciones'] });
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast.success('Inspector actualizado');
      setEditingInspector(null);
      setInspectorValue('');
    },
  });

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
                    <div className="flex gap-2 mt-1 flex-wrap items-center">
                      <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">
                        {dir.comuna}
                      </Badge>
                      {dir.jefe_sitio && (
                        <Badge className="bg-blue-500/20 text-blue-300 border-0 text-xs">
                          <Users className="h-2.5 w-2.5 mr-1" /> {dir.jefe_sitio}
                        </Badge>
                      )}
                      {editingInspector === dir.id ? (
                        <span className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <input
                            autoFocus
                            value={inspectorValue}
                            onChange={e => setInspectorValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') updateDireccionMutation.mutate({ id: dir.id, data: { inspector: inspectorValue } });
                              if (e.key === 'Escape') { setEditingInspector(null); setInspectorValue(''); }
                            }}
                            className="bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-xs text-white w-36 outline-none focus:border-primary/50"
                            placeholder="Nombre inspector..."
                          />
                          <button
                            onClick={() => updateDireccionMutation.mutate({ id: dir.id, data: { inspector: inspectorValue } })}
                            className="text-emerald-400 hover:text-emerald-300"
                          ><Check className="h-3.5 w-3.5" /></button>
                          <button
                            onClick={() => { setEditingInspector(null); setInspectorValue(''); }}
                            className="text-slate-400 hover:text-slate-300"
                          ><X className="h-3.5 w-3.5" /></button>
                        </span>
                      ) : (
                        <span
                          onClick={e => { e.stopPropagation(); setEditingInspector(dir.id); setInspectorValue(dir.inspector || ''); }}
                          className="cursor-pointer"
                        >
                          {dir.inspector ? (
                            <Badge className="bg-purple-500/20 text-purple-300 border-0 text-xs hover:bg-purple-500/30">
                              <UserCheck className="h-2.5 w-2.5 mr-1" />{dir.inspector}
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-700/50 text-slate-500 border border-dashed border-slate-600 text-xs hover:border-slate-500 hover:text-slate-400">
                              + Asignar inspector
                            </Badge>
                          )}
                        </span>
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