import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowRight, Clock, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const TIPO_EMOJI = {
  incendio: '🔥', inundacion: '💧', corte_electrico: '⚡', derrumbe: '🧱',
  rotura_gas: '💨', vandalismo: '🚨', accidente: '🏥', otro: '⚠️',
};

const ESTADO_CONFIG = {
  activa:      { label: 'ACTIVA',      cls: 'bg-red-500 text-white animate-pulse' },
  en_atencion: { label: 'En Atención', cls: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50' },
};

export default function EmergenciasWidget() {
  const { data: emergencias = [] } = useQuery({
    queryKey: ['emergencias-widget'],
    queryFn: () => base44.entities.Emergencia.filter({ estado: ['activa', 'en_atencion'] }, '-created_date', 5),
    refetchInterval: 60000,
    staleTime: 1000 * 30,
  });

  const activas = emergencias.filter(e => e.estado === 'activa').length;
  const enAtencion = emergencias.filter(e => e.estado === 'en_atencion').length;

  return (
    <Card className="border-0 bg-gradient-to-br from-red-900/20 to-slate-900/50 backdrop-blur-xl shadow-lg border border-red-500/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            Emergencias Activas
            {activas > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white animate-pulse">
                {activas}
              </span>
            )}
          </CardTitle>
          <Link to="/emergencias">
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-slate-400 hover:text-white">
              Ver todas <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {emergencias.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-emerald-400 text-sm font-medium">✅ Sin emergencias activas</p>
            <p className="text-slate-500 text-xs mt-1">Todo en orden</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Resumen */}
            <div className="flex gap-2 mb-3">
              {activas > 0 && (
                <span className="px-2 py-1 rounded-md text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                  🔴 {activas} activa{activas > 1 ? 's' : ''}
                </span>
              )}
              {enAtencion > 0 && (
                <span className="px-2 py-1 rounded-md text-xs font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                  🟡 {enAtencion} en atención
                </span>
              )}
            </div>

            {/* Lista */}
            {emergencias.map(e => {
              const estadoCfg = ESTADO_CONFIG[e.estado];
              return (
                <div key={e.id} className="flex items-start gap-3 p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/60 transition-colors">
                  <span className="text-lg flex-shrink-0">{TIPO_EMOJI[e.tipo] || '⚠️'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${estadoCfg?.cls}`}>
                        {estadoCfg?.label}
                      </span>
                      <span className="text-white text-xs font-medium truncate">{e.titulo}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                      {e.establecimiento && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5" />{e.establecimiento}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {formatDistanceToNow(new Date(e.created_date), { locale: es, addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}