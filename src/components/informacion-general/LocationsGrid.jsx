import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Building2, Users, MapPin, Zap } from 'lucide-react';

export default function LocationsGrid({ locations, isLoading }) {
  const [search, setSearch] = useState('');

  const filtered = locations.filter(loc => {
    const q = search.toLowerCase();
    return (
      loc.establecimiento?.toLowerCase().includes(q) ||
      loc.direccion?.toLowerCase().includes(q) ||
      loc.ubic_tecnica?.toLowerCase().includes(q) ||
      loc.jefe_sitio?.toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-slate-200 border-t-primary rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por escuela, dirección, ubicación técnica..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Sin resultados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(loc => (
            <Card key={loc.id} className="hover:shadow-md transition-all border-slate-200/50 hover:border-primary/30">
              <CardContent className="pt-5 pb-4 space-y-3">
                {/* Title */}
                <div>
                  <p className="font-bold text-slate-900 text-sm leading-tight" title={loc.establecimiento}>
                    {loc.establecimiento}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{loc.direccion || 'Sin dirección'}</p>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5">
                  {loc.ubic_tecnica && (
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {loc.ubic_tecnica}
                    </Badge>
                  )}
                  <Badge className={`text-[10px] border-0 ${
                    loc.comuna === '8A' ? 'bg-blue-100 text-blue-700' :
                    loc.comuna === '8B' ? 'bg-purple-100 text-purple-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {loc.comuna}
                  </Badge>
                  {loc.estado === 'activo' && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">
                      <Zap className="h-2.5 w-2.5 mr-1" /> Activo
                    </Badge>
                  )}
                </div>

                {/* Info row */}
                <div className="bg-slate-50 rounded-lg p-2.5 space-y-1.5 text-xs">
                  {loc.m2 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Superficie:</span>
                      <span className="font-semibold">{loc.m2.toFixed(0)} m²</span>
                    </div>
                  )}
                  {loc.jefe_sitio && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" /> Jefe:
                      </span>
                      <span className="font-semibold text-right">{loc.jefe_sitio}</span>
                    </div>
                  )}
                  {loc.inspector && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Inspector:</span>
                      <span className="font-semibold text-right">{loc.inspector}</span>
                    </div>
                  )}
                </div>

                {/* Element PEP */}
                {loc.elem_pep && (
                  <div className="text-center pt-2 border-t border-slate-200">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Elemento PEP</p>
                    <p className="font-mono text-sm font-bold text-primary">{loc.elem_pep}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      {filtered.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          Mostrando {filtered.length} de {locations.length} escuelas
        </div>
      )}
    </div>
  );
}