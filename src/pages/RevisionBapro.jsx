import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, CheckCircle2, ShieldCheck, Building2, Clock, AlertTriangle, FileWarning, Wrench } from 'lucide-react';

const typeLabels = {
  equipo_electrico: 'Equipo eléctrico', equipo_mecanico: 'Equipo mecánico', instalacion_hvac: 'Climatización (HVAC)',
  instalacion_sanitaria: 'Instalación sanitaria', estructura: 'Estructura', vehiculo: 'Vehículo',
  herramienta: 'Herramienta', sistemas_informaticos: 'Sistemas informáticos', mobiliario: 'Mobiliario',
  seguridad: 'Seguridad', otro: 'Otro',
};
const statusLabels = {
  operativo: 'Operativo', en_mantenimiento: 'En mantenimiento', fuera_de_servicio: 'Fuera de servicio', baja: 'Baja',
};
const otStatusLabels = {
  pendiente: 'Pendiente', asignada: 'Asignada', en_progreso: 'En progreso', obra: 'En obra',
  pendiente_validacion: 'P. validación', completada: 'Completada', cancelada: 'Cancelada',
};
const otStatusStyles = {
  pendiente: 'bg-slate-100 text-slate-600', asignada: 'bg-blue-100 text-blue-700',
  en_progreso: 'bg-amber-100 text-amber-700', obra: 'bg-amber-100 text-amber-700',
  pendiente_validacion: 'bg-violet-100 text-violet-700', completada: 'bg-emerald-100 text-emerald-700',
  cancelada: 'bg-red-100 text-red-700',
};

export default function RevisionBapro() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [markingId, setMarkingId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

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
          <p className="text-sm text-slate-500">Cargando inventario…</p>
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

  return (
    <div className="min-h-screen bg-slate-50">
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

        {/* Acción marcar todos */}
        {activos.length > 0 && !todosVistos && (
          <div className="mb-4 flex items-center justify-between gap-3 bg-white rounded-xl border border-slate-200 p-3.5">
            <div>
              <p className="text-sm font-medium text-slate-700">Marcar todos como vistos</p>
              <p className="text-xs text-slate-500">Registra la revisión completa del lote en un solo paso.</p>
            </div>
            <button
              onClick={marcarTodos}
              disabled={markingAll}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
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

        {/* Lista de activos */}
        {activos.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
            <p className="text-sm text-slate-500">No hay activos en este lote de revisión.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activos.map(a => (
              <div key={a.id} className={`bg-white rounded-xl border p-4 flex items-center justify-between gap-3 transition-colors ${a.visto_bapro ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">{a.name}</span>
                    {a.code && <span className="text-[11px] text-slate-400 font-mono">{a.code}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-slate-500">
                    {a.sede && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{a.sede}</span>}
                    {a.area && <span>· {a.area}</span>}
                    <span>· {typeLabels[a.type] || a.type}</span>
                    <span>· {statusLabels[a.status] || a.status}</span>
                    {a.brand && <span>· {a.brand} {a.model}</span>}
                  </div>
                  {a.visto_bapro && a.visto_bapro_fecha && (
                    <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Visto el {new Date(a.visto_bapro_fecha).toLocaleString('es-AR')}
                    </p>
                  )}
                  {Array.isArray(a.ots) && a.ots.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mb-1">
                        <Wrench className="h-3 w-3" /> Órdenes de trabajo ({a.ots.length})
                      </p>
                      <div className="space-y-1">
                        {a.ots.map((o, i) => (
                          <div key={i} className="text-[11px] text-slate-600 flex items-center gap-2 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded font-medium ${otStatusStyles[o.status] || 'bg-slate-100 text-slate-600'}`}>{otStatusLabels[o.status] || o.status}</span>
                            <span className="font-medium text-slate-700">{o.title}</span>
                            {o.scheduled_date && <span className="text-slate-400">· {new Date(o.scheduled_date).toLocaleDateString('es-AR')}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {a.visto_bapro ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-medium">
                      <CheckCircle2 className="h-4 w-4" /> Visto
                    </span>
                  ) : (
                    <button
                      onClick={() => marcarUno(a.id)}
                      disabled={markingId === a.id}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                    >
                      {markingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Marcar visto
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <footer className="mt-8 pt-4 border-t border-slate-200 text-center text-[11px] text-slate-400 space-y-2">
          <div className="flex justify-center">
            <img
              src="https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/36319e6f8_mejolesh.jpg"
              alt="Mejores"
              className="h-7 w-auto opacity-60 grayscale-[20%]"
            />
          </div>
          <p>Portal de revisión seguro · Solo lectura · {activos.length} activos</p>
        </footer>
      </main>
    </div>
  );
}