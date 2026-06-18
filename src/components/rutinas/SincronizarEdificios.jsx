import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { RefreshCw, Building2, CheckCircle2, AlertCircle, Zap, ChevronRight, Loader2 } from 'lucide-react';

export default function SincronizarEdificios() {
  const [fase, setFase] = useState('idle'); // idle | paso1 | paso2 | done | error
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });
  const [resultado, setResultado] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const sincronizar = async () => {
    setFase('paso1');
    setResultado(null);
    setErrorMsg('');

    try {
      // ── PASO 1: Crear edificios desde LocationData ──
      const res1 = await base44.functions.invoke('sincronizarEdificiosRutinas', { paso: 1 });
      const d1 = res1.data;
      if (!d1.ok) throw new Error(d1.error || 'Error en paso 1');

      // ── PASO 2: Asignar rutinas a cada edificio nuevo ──
      setFase('paso2');

      // Obtener los edificios recién creados (o todos sin asignaciones)
      const todosEdificios = await base44.entities.Edificio.list();
      const edificiosSinRutinas = [];

      // Detectar cuáles no tienen asignaciones aún
      for (const e of todosEdificios) {
        const asig = await base44.entities.RutinaEdificio.filter({ edificio_id: e.id });
        if (asig.length === 0) edificiosSinRutinas.push(e);
      }

      setProgreso({ actual: 0, total: edificiosSinRutinas.length });

      let totalAsignaciones = 0;
      for (let i = 0; i < edificiosSinRutinas.length; i++) {
        const e = edificiosSinRutinas[i];
        const res2 = await base44.functions.invoke('sincronizarEdificiosRutinas', {
          paso: 2,
          edificio_id: e.id,
          edificio_nombre: e.nombre,
        });
        totalAsignaciones += res2.data?.asignaciones_creadas || 0;
        setProgreso({ actual: i + 1, total: edificiosSinRutinas.length });
      }

      setResultado({
        edificios_creados: d1.edificios_creados,
        edificios_totales: d1.edificios_totales,
        asignaciones_creadas: totalAsignaciones,
        edificios_sin_rutinas: edificiosSinRutinas.length,
      });
      setFase('done');
      toast.success(`Sincronización completa: ${d1.edificios_creados} edificios nuevos, ${totalAsignaciones} asignaciones creadas`);

    } catch (err) {
      setErrorMsg(err.message || 'Error desconocido');
      setFase('error');
      toast.error(err.message || 'Error al sincronizar');
    }
  };

  const isRunning = fase === 'paso1' || fase === 'paso2';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)' }}>
            <Zap className="h-6 w-6" style={{ color: '#D4AF37' }} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Sincronización Automática de Ubicaciones</h3>
            <p className="text-sm text-white/60 mt-0.5 leading-relaxed">
              Toma todos los establecimientos existentes (con su jefe de sitio) y los registra como edificios
              con el catálogo completo de rutinas del <strong className="text-white/80">Anexo 3</strong> asignado.
            </p>
          </div>
        </div>

        {/* Pasos visuales */}
        <div className="flex items-center gap-2">
          {[
            { n: 1, label: 'Crear edificios', desc: 'Desde LocationData' },
            { n: 2, label: 'Asignar rutinas', desc: 'Catálogo completo' },
            { n: 3, label: 'Procesar órdenes', desc: 'En Tablero' },
          ].map((paso, idx) => (
            <React.Fragment key={paso.n}>
              <div className={`flex-1 rounded-xl px-3 py-3 border text-center transition-colors ${
                (fase === 'paso1' && paso.n === 1) || (fase === 'paso2' && paso.n === 2) || (fase === 'done' && paso.n <= 2)
                  ? 'border-yellow-500/40 bg-yellow-500/10'
                  : 'border-white/8 bg-white/5'
              }`}>
                <p className="text-xs font-bold text-white/80">{paso.label}</p>
                <p className="text-[10px] text-white/40 mt-0.5">{paso.desc}</p>
              </div>
              {idx < 2 && <ChevronRight className="h-4 w-4 text-white/20 flex-shrink-0" />}
            </React.Fragment>
          ))}
        </div>

        {/* Progreso paso 2 */}
        {fase === 'paso2' && progreso.total > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-white/50">
              <span>Asignando rutinas a edificios…</span>
              <span className="tabular-nums">{progreso.actual} / {progreso.total}</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progreso.total > 0 ? Math.round((progreso.actual / progreso.total) * 100) : 0}%`,
                  background: 'linear-gradient(90deg, #D4AF37, #b8960f)',
                }}
              />
            </div>
          </div>
        )}

        {/* Botón principal */}
        <Button
          onClick={sincronizar}
          disabled={isRunning}
          className="w-full gap-3 font-bold h-12 text-base"
          style={{ background: isRunning ? 'rgba(212,175,55,0.3)' : 'linear-gradient(135deg, #D4AF37, #b8960f)', color: '#0A2540' }}
        >
          {fase === 'paso1' && <><Loader2 className="h-5 w-5 animate-spin" /> Creando edificios…</>}
          {fase === 'paso2' && <><Loader2 className="h-5 w-5 animate-spin" /> Asignando rutinas ({progreso.actual}/{progreso.total})…</>}
          {!isRunning && <><Building2 className="h-5 w-5" /> Sincronizar Ubicaciones → Rutinas</>}
        </Button>
      </div>

      {/* Resultado exitoso */}
      {fase === 'done' && resultado && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            <p className="font-bold text-emerald-300 text-lg">¡Sincronización completa!</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Edificios creados', value: resultado.edificios_creados },
              { label: 'Total edificios', value: resultado.edificios_totales },
              { label: 'Asignaciones creadas', value: resultado.asignaciones_creadas },
              { label: 'Edificios procesados', value: resultado.edificios_sin_rutinas },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/5 rounded-xl px-4 py-3 border border-white/8">
                <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
                <p className="text-2xl font-bold text-white tabular-nums mt-1">{value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200/80">
            <strong className="text-yellow-300">Siguiente paso:</strong> Ir al <strong>Tablero de Órdenes</strong> y presionar
            <strong> "Procesar rutinas"</strong> para generar automáticamente las primeras órdenes de mantenimiento.
          </div>
        </div>
      )}

      {/* Error */}
      {fase === 'error' && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-300">Error en la sincronización</p>
            <p className="text-sm text-red-300/70 mt-1">{errorMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
}