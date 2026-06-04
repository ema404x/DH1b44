import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

const MODULE_LABELS = {
  pendientes: { label: 'Pendientes SAP', color: 'bg-yellow-500/20 text-yellow-300' },
  obras: { label: 'Obras Certificación', color: 'bg-blue-500/20 text-blue-300' },
  calefaccion: { label: 'Calefacción', color: 'bg-orange-500/20 text-orange-300' },
};

export default function SincronizarModulos() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('sincronizarPendientes', {
        modules: ['pendientes', 'obras', 'calefaccion'],
        force_all: true,
      });
      const d = res.data;
      setResult(d);
      if (d.total_actualizados > 0) {
        toast.success(`Sincronización completa: ${d.total_actualizados} registros actualizados en ${Object.keys(d.detalle).length} módulos`);
      } else {
        toast.success('Todo ya estaba sincronizado — no hubo cambios necesarios');
      }
    } catch (e) {
      toast.error('Error al sincronizar: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl backdrop-blur p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Sincronizar Módulos del Sistema
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Propaga los jefes de sitio e inspectores actuales a todos los módulos: Pendientes SAP, Obras de Certificación y Calefacción.
          </p>
        </div>
        <Button
          onClick={handleSync}
          disabled={syncing}
          className="flex-shrink-0 gap-2 bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Sincronizando...' : 'Sincronizar Todo'}
        </Button>
      </div>

      {/* Módulos que se sincronizan */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(MODULE_LABELS).map(([key, { label, color }]) => (
          <Badge key={key} className={`${color} border-0`}>{label}</Badge>
        ))}
      </div>

      {/* Resultado */}
      {result && (
        <div className={`rounded-lg border p-4 space-y-3 ${result.total_actualizados > 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-700/30 border-slate-600/30'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {result.total_actualizados > 0
                ? <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                : <CheckCircle2 className="h-5 w-5 text-slate-400" />
              }
              <span className="font-semibold text-white">
                {result.total_actualizados} registros actualizados de {result.total_procesados} procesados
              </span>
            </div>
            <button
              onClick={() => setShowDetail(v => !v)}
              className="text-slate-400 hover:text-white flex items-center gap-1 text-xs"
            >
              Ver detalle {showDetail ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>

          {showDetail && result.detalle && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-600/30">
              {Object.entries(result.detalle).map(([key, data]) => (
                <div key={key} className="bg-slate-800/50 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-slate-300 uppercase">{MODULE_LABELS[key]?.label || key}</p>
                  <p className="text-xl font-bold text-white">{data.actualizados}</p>
                  <p className="text-xs text-slate-500">actualizados / {data.procesados} procesados</p>
                  {data.errors > 0 && (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {data.errors} errores
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}