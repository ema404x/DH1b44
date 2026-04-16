import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, MapPin, Building2, Zap } from 'lucide-react';

export default function DireccionPanel({ direccionData, isExpanded, onToggle, comunas }) {
  const getColorByComuna = (comunaId) => 
    comunas.find(c => c.id === comunaId)?.color || 'bg-slate-100 text-slate-700';

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full text-left"
      >
        <CardContent className="pt-4 pb-4 flex items-center justify-between group">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center flex-shrink-0">
              <MapPin className="h-6 w-6 text-orange-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-lg text-slate-900 truncate">{direccionData.direccion || 'Sin dirección'}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {Object.keys(direccionData.comunas).sort().map(comunaId => (
                  <Badge key={comunaId} className={`${getColorByComuna(comunaId)} border-0`}>
                    {comunaId}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 ml-2 flex-shrink-0">
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900">{direccionData.locations.length}</p>
              <p className="text-xs text-muted-foreground">escuelas</p>
            </div>
            <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors group-hover:bg-slate-100">
              {isExpanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
            </button>
          </div>
        </CardContent>
      </button>

      {/* Content expandido */}
      {isExpanded && (
        <div className="border-t border-slate-100 bg-slate-50/50">
          <div className="px-6 py-4 space-y-3">
            {direccionData.locations.map(loc => (
              <div
                key={loc.id}
                className="bg-white rounded-lg p-3 border border-slate-200 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate text-sm">{loc.establecimiento}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{loc.direccion}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {loc.ubic_tecnica && (
                        <Badge variant="outline" className="text-[10px]">{loc.ubic_tecnica}</Badge>
                      )}
                      <Badge className={getColorByComuna(loc.comuna)} >
                        {loc.comuna}
                      </Badge>
                      {loc.jefe_sitio && (
                        <Badge variant="secondary" className="text-[10px]">{loc.jefe_sitio}</Badge>
                      )}
                      {loc.estado === 'activo' && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">
                          <Zap className="h-2.5 w-2.5 mr-0.5" /> Activo
                        </Badge>
                      )}
                    </div>
                  </div>
                  {loc.m2 && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-muted-foreground">Superficie</p>
                      <p className="font-bold text-sm text-slate-900">{loc.m2.toFixed(0)} m²</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}