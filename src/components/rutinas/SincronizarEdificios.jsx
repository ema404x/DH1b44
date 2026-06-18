import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Building2, CheckCircle2, AlertCircle, Zap, Loader2, ChevronRight, RefreshCw } from 'lucide-react';

const CHUNK_SIZE = 5; // edificios por llamada al backend

export default function SincronizarEdificios() {
  const [fase, setFase] = useState('idle'); // idle | cargando | edificios | rutinas | done | error
  const [info, setInfo] = useState(null);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });
  const [resultado, setResultado] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Al montar, cargar estado actual
  useEffect(() => { cargarInfo(); }, []);

  const cargarInfo = async () => {
    setFase('cargando');
    try {
      const res = await base44.functions.invoke('sincronizarEdificiosRutinas', { accion: 'info' });
      setInfo(res.data);
      setFase('idle');
    } catch {
      setFase('idle');
    }
  };

  const sincronizar = async () => {
    setFase('edificios');
    setResultado(null);
    setErrorMsg('');

    try {
      // Paso 1: crear edificios faltantes
      const r1 = await base44.functions.invoke('sincronizarEdificiosRutinas', { accion: 'sync_edificios' });
      if (!r1.data?.ok) throw new Error(r1.data?.error || 'Error al crear edificios');
      const edificiosCreados = r1.data.edificios_creados;

      // Paso 2: obtener info actualizada
      setFase('rutinas');
      const r2 = await base44.functions.invoke('sincronizarEdificiosRutinas', { accion: 'info' });
      const pendientes = r2.data?.pendientes_ids || [];

      if (pendientes.length === 0) {
        setResultado({ edificios_creados: edificiosCreados, asignaciones_creadas: 0, edificios_procesados: 0 });
        setFase('done');
        toast.success('Todo ya estaba sincronizado');
        return;
      }

      // Paso 3: asignar rutinas en chunks para evitar rate limit
      setProgreso({ actual: 0, total: pendientes.length });
      let totalAsig = 0;

      for (let i = 0; i < pendientes.length; i += CHUNK_SIZE) {
        const chunk = pendientes.slice(i, i + CHUNK_SIZE).map(e => e.id);
        const r3 = await base44.functions.invoke('sincronizarEdificiosRutinas', {
          accion: 'sync_rutinas',
          edificio_ids: chunk,
        });
        totalAsig += r3.data?.asignaciones_creadas || 0;
        setProgreso({ actual: Math.min(i + CHUNK_SIZE, pendientes.length), total: pendientes.length });

        // Pausa entre chunks en el frontend
        if (i + CHUNK_SIZE < pendientes.length) {
          await new Promise(res => setTimeout(res, 500));
        }
      }

      const r4 = await base44.functions.invoke('sincronizarEdificiosRutinas', { accion: 'info' });
      setInfo(r4.data);

      setResultado({
        edificios_creados: edificiosCreados,
        asignaciones_creadas: totalAsig,
        edificios_procesados: pendientes.length,
        total_edificios: r4.data?.edificios_total || 0,
      });
      setFase('done');
      toast.success(`Sincronización completa: ${edificiosCreados} edificios nuevos, ${totalAsig} asignaciones creadas`);

    } catch (err) {
      setErrorMsg(err.message || 'Error desconocido');
      setFase('error');
      toast.error(err.message || 'Error al sincronizar');
    }
  };

  const isRunning = fase === 'edificios' || fase === 'rutinas';
  const pct = progreso.total > 0 ? Math.round((progreso.actual / progreso.total) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5">

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)' }}>
            <Zap className="h-6 w-6" style={{ color: '#D4AF37' }} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white">Sincronización de Rutinas</h3>
            <p className="text-sm text-white/50 mt-0.5">
              Crea edificios desde los establecimientos activos y asigna el catálogo completo del{' '}
              <strong className="text-white/70">Anexo 3</strong>.
            </p>
          </div>
          <button onClick={cargarInfo} disabled={isRunning || fase === 'cargando'}
            className="text-white/30 hover:text-white/60 transition-colors mt-1">
            <RefreshCw className={`h-4 w-4 ${fase === 'cargando' ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Estado actual */}
        {info && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Edificios', value: info.edificios_total, color: '#60a5fa' },
              { label: 'Sin rutinas', value: info.edificios_sin_asignacion, color: info.edificios_sin_asignacion > 0 ? '#facc15' : '#34d399' },
              { label: 'Asignaciones', value: info.asignaciones_existentes, color: '#D4AF37' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl bg-white/5 border border-white/8 px-4 py-3 text-center">
                <p className="text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
                <p className="text-[10px] text-white/40 mt-0.5 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Pasos */}
        <div className="flex items-center gap-2">
          {[
            { label: 'Crear edificios', active: fase === 'edificios' },
            { label: 'Asignar rutinas', active: fase === 'rutinas' },
            { label: 'Listo', active: fase === 'done' },
          ].map((paso, idx) => (
            <React.Fragment key={paso.label}>
              <div className={`flex-1 rounded-xl px-3 py-2.5 border text-center transition-all ${
                paso.active ? 'border-yellow-500/40 bg-yellow-500/10' :
                fase === 'done' ? 'border-emerald-500/30 bg-emerald-500/10' :
                'border-white/8 bg-white/5'
              }`}>
                <p className="text-xs font-semibold text-white/70">{paso.label}</p>
              </div>
              {idx < 2 && <ChevronRight className="h-4 w-4 text-white/20 flex-shrink-0" />}
            </React.Fragment>
          ))}
        </div>

        {/* Barra de progreso */}
        {fase === 'rutinas' && progreso.total > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-white/40">
              <span>Procesando edificios…</span>
              <span className="tabular-nums">{progreso.actual} / {progreso.total} ({pct}%)</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #D4AF37, #b8960f)' }} />
            </div>
          </div>
        )}

        {/* Botón */}
        <Button
          onClick={sincronizar}
          disabled={isRunning || fase === 'cargando'}
          className="w-full gap-2 font-bold h-11"
          style={{
            background: isRunning ? 'rgba(212,175,55,0.25)' : 'linear-gradient(135deg, #D4AF37, #b8960f)',
            color: '#0A2540',
          }}
        >
          {isRunning
            ? <><Loader2 className="h-4 w-4 animate-spin" />
                {fase === 'edificios' ? 'Creando edificios…' : `Asignando rutinas (${progreso.actual}/${progreso.total})…`}
              </>
            : <><Building2 className="h-4 w-4" /> Sincronizar</>
          }
        </Button>

        {info?.edificios_sin_asignacion === 0 && fase === 'idle' && (
          <p className="text-center text-xs text-emerald-400/70 flex items-center justify-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Todos los edificios tienen rutinas asignadas
          </p>
        )}
      </div>

      {/* Resultado */}
      {fase === 'done' && resultado && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <p className="font-bold text-emerald-300">¡Sincronización completa!</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Edificios creados', value: resultado.edificios_creados },
              { label: 'Edificios procesados', value: resultado.edificios_procesados },
              { label: 'Asignaciones creadas', value: resultado.asignaciones_creadas },
              { label: 'Total edificios', value: resultado.total_edificios },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/5 rounded-xl px-4 py-3 border border-white/8">
                <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
                <p className="text-xl font-bold text-white tabular-nums mt-0.5">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-yellow-200/60 text-center">
            Ir al <strong className="text-yellow-300">Tablero</strong> y presionar{' '}
            <strong className="text-yellow-300">Procesar rutinas</strong> para generar las órdenes.
          </p>
        </div>
      )}

      {/* Error */}
      {fase === 'error' && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-300">Error en la sincronización</p>
            <p className="text-sm text-red-300/60 mt-1">{errorMsg}</p>
            <button onClick={sincronizar} className="mt-3 text-xs text-red-300 underline">Reintentar</button>
          </div>
        </div>
      )}
    </div>
  );
}