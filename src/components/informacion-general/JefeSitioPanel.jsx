import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Users, MapPin, Zap } from 'lucide-react';

export default function JefeSitioPanel({ jefeData, isExpanded, onToggle, comunas }) {
  const getCountByComuna = (comunaId) => jefeData.comunas[comunaId]?.length || 0;
  const getColorByComunaId = (comunaId) => comunas.find(c => c.id === comunaId)?.color || 'bg-slate-100 text-slate-700';

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full text-left"
      >
        <CardContent className="pt-4 pb-4 flex items-center justify-between group">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-lg text-slate-900 truncate">{jefeData.nombre}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {Object.keys(jefeData.comunas).sort().map(comunaId => (
                  <Badge key={comunaId} className={`${getColorByComunaId(comunaId)} border-0`}>
                    {comunaId} ({getCountByComuna(comunaId)})
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 ml-2 flex-shrink-0">
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900">{jefeData.locations.length}</p>
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
          <div className="px-6 py-4 space-y-4">
            {Object.keys(jefeData.comunas).sort().map(comunaId => (
              <div key={comunaId} className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <span className="font-semibold text-sm text-slate-900">Comuna {comunaId}</span>
                  <Badge variant="secondary">{getCountByComuna(comunaId)}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 ml-6">
                  {jefeData.comunas[comunaId].map(loc => (
                    <div
                      key={loc.id}
                      className="bg-white rounded-lg p-3 text-sm border border-slate-200 hover:border-primary/30 transition-colors"
                    >
                      <p className="font-medium text-slate-900 truncate" title={loc.establecimiento}>
                        {loc.establecimiento}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{loc.direccion || 'Sin dirección'}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {loc.ubic_tecnica && (
                          <Badge variant="outline" className="text-[10px]">{loc.ubic_tecnica}</Badge>
                        )}
                        {loc.m2 && (
                          <Badge variant="outline" className="text-[10px]">{loc.m2.toFixed(0)} m²</Badge>
                        )}
                        {loc.estado === 'activo' && (
                          <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">
                            <Zap className="h-2.5 w-2.5 mr-0.5" /> Activo
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}