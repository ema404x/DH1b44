import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, CheckCircle2, ShieldCheck, Building2, Clock, AlertTriangle, FileWarning, Wrench, Boxes } from 'lucide-react';
import AssetCardRevision from '@/components/bapro/AssetCardRevision';
import OTsMesList from '@/components/bapro/OTsMesList';

export default function RevisionBapro() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [markingId, setMarkingId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [tab, setTab] = useState('activos');

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('obtenerActivosParaRevision', { token });
      const body = res?.data ?? res;
      if (body?.error) { setError(body.error); return; }
      setData(body);
    } catch (err) {
      setError(err.message || 'Error al cargar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [token]);

  const marcarUno = async (assetId) => {
    setMarkingId(assetId);
    try {
      await base44.functions.invoke('registrarVistoBapro', { token, asset_id: assetId });
      setData(prev => ({
        ...prev,
        activos: (prev.activos || []).map(a => a.id === assetId ? { ...a, visto_bapro: true, visto_bapro_fecha: new Date().toISOString() } : a),
        vistos: (prev.vistos || 0) + 1,
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setMarkingId(null);
    }
  };

  const marcarTodos = async () => {
    setMarkingAll(true);
    try {
      await base44.functions.invoke('registrarVistoBapro', { token, marcar_todos: true });
      setData(prev => ({
        ...prev,
        activos: (prev.activos || []).map(a => ({ ...a, visto_bapro: true, visto_bapro_fecha: new Date().toISOString() })),
        vistos: prev.total,
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setMarkingAll(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 mx-auto mb-3 text-blue-600 animate-spin" />
          <p className="text-sm text-slate-500">Cargando revisión…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="h-14 w-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <FileWarning className="h-7 w-7 text-red-500" />
          </div>
          <h1 className="text-lg font-semibold text-slate-800 mb-1">No se pudo acceder</h1>
          <p className="text-sm text-slate-500">{error}</p>
          <p className="text-xs text-slate-400 mt-3">Si el problema persiste, contacte a la empresa que le compartió este link.</p>
        </div>
      </div>
    );
  }

  const activos = data?.activos || [];
  const vistos = activos.filter(a => a.visto_bapro).length;
  const pct = data?.total > 0 ? Math.round((vistos / data.total) * 100) : 0;
  const todosVistos = vistos === data?.total && data?.total > 0;
  const totalOtsMes = data?.total_ots_mes ?? (data?.ots_mes?.length || 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Logo superior — Mejores */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex justify-end">
          <img
            src="https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/bcab542cd_mejores_logo.jpg"
            alt="Mejores — en mantenimiento, obras y servicios"
            className="h-16 w-16 object-cover rounded-xl shadow-sm ring-1 ring-slate-200"
          />
        </div>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-slate-800">Revisión de Activos · BAPRO</h1>
                <p className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                  <Building2 className="h-3 w-3" />{data?.sede_nombre} · Período {data?.mes_periodo}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5" />
              Vence {new Date(data?.expiracion).toLocaleDateString('es-AR')}
            </div>
          </div>

          {/* Progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-600 font-medium">{vistos} de {data?.total} activos revisados</span>
              <span className="text-slate-500 tabular-nums">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {error && (
          <div className="mb-4 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-lg">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-4 bg-white rounded-xl border border-slate-200 p-1.5">
          <button onClick={() => setTab('activos')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'activos' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Boxes className="h-4 w-4" /> Activos y modificaciones
            <span className={`text-[11px] px-1.5 py-0.5 rounded-md tabular-nums ${tab === 'activos' ? 'bg-white/20' : 'bg-slate-100'}`}>{activos.length}</span>
          </button>
          <button onClick={() => setTab('ots')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'ots' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Wrench className="h-4 w-4" /> OTs del mes
            <span className={`text-[11px] px-1.5 py-0.5 rounded-md tabular-nums ${tab === 'ots' ? 'bg-white/20' : 'bg-slate-100'}`}>{totalOtsMes}</span>
          </button>
        </div>

        {tab === 'activos' && (
          <>
            {/* Acción marcar todos */}
            {activos.length > 0 && !todosVistos && (
              <div className="mb-4 flex items-center justify-between gap-3 bg-white rounded-xl border border-slate-200 p-3.5">
                <div>
                  <p className="text-sm font-medium text-slate-700">Marcar todos como vistos</p>
                  <p className="text-xs text-slate-500">Registra la revisión completa del lote en un solo paso.</p>
                </div>
                <button onClick={marcarTodos} disabled={markingAll}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors">
                  {markingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Marcar todos
                </button>
              </div>
            )}

            {todosVistos && (
              <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <p className="text-sm text-emerald-700 font-medium">Revisión completa. Todos los activos fueron vistos.</p>
              </div>
            )}

            {activos.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
                <p className="text-sm text-slate-500">No hay activos en este lote de revisión.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activos.map(a => (
                  <AssetCardRevision key={a.id} asset={a} onMarcar={marcarUno} marking={markingId === a.id} />
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'ots' && (
          <OTsMesList ots={data?.ots_mes || []} />
        )}

        <footer className="mt-8 pt-4 border-t border-slate-200 text-center text-[11px] text-slate-400 space-y-2">
          <p>Portal de revisión seguro · Solo lectura · {activos.length} activos · {totalOtsMes} OTs del mes</p>
        </footer>
      </main>
    </div>
  );
}