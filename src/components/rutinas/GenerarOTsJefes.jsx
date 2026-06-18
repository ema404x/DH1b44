import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Wrench, Building2, CheckCircle2, Loader2, AlertTriangle,
  RefreshCw, ChevronDown, ChevronRight, Send
} from 'lucide-react';
import { format } from 'date-fns';

export default function GenerarOTsJefes() {
  const qc = useQueryClient();
  const [expandedEdificio, setExpandedEdificio] = useState(null);
  const [generando, setGenerando] = useState({}); // { edificioId: true/false }
  const [generados, setGenerados] = useState({}); // { edificioId: otId }

  // Cargar órdenes pendientes / vencidas sin OT generada
  const { data: ordenes = [], isLoading } = useQuery({
    queryKey: ['ordenes-rutina-pendientes-ot'],
    queryFn: async () => {
      const [pendientes, vencidas] = await Promise.all([
        base44.entities.OrdenRutina.filter({ estado: 'pendiente' }),
        base44.entities.OrdenRutina.filter({ estado: 'vencida' }),
      ]);
      // Solo las que NO tienen OT generada aún
      return [...pendientes, ...vencidas].filter(o => !o.work_order_id);
    },
    staleTime: 60_000,
  });

  // Cargar edificios para obtener jefe de sitio
  const { data: edificios = [] } = useQuery({
    queryKey: ['edificios'],
    queryFn: () => base44.entities.Edificio.list('nombre', 200),
    staleTime: 300_000,
  });

  const edificioMap = useMemo(() => {
    const m = {};
    for (const e of edificios) m[e.id] = e;
    return m;
  }, [edificios]);

  // Agrupar órdenes por edificio
  const grupos = useMemo(() => {
    const m = {};
    for (const o of ordenes) {
      const key = o.edificio_id || o.edificio_nombre || 'sin-edificio';
      if (!m[key]) {
        m[key] = {
          edificio_id: o.edificio_id,
          edificio_nombre: o.edificio_nombre || 'Sin edificio',
          ordenes: [],
        };
      }
      m[key].ordenes.push(o);
    }
    return Object.values(m).sort((a, b) => a.edificio_nombre.localeCompare(b.edificio_nombre));
  }, [ordenes]);

  const generarOTParaEdificio = async (grupo) => {
    const key = grupo.edificio_id || grupo.edificio_nombre;
    setGenerando(prev => ({ ...prev, [key]: true }));

    try {
      const edificio = edificioMap[grupo.edificio_id];
      const jefeSitio = edificio?.jefe_sitio || '';
      const hoy = format(new Date(), 'yyyy-MM-dd');

      // Calcular fecha límite = la más cercana de las rutinas
      const fechasLimite = grupo.ordenes
        .map(o => o.fecha_limite)
        .filter(Boolean)
        .sort();
      const fechaLimite = fechasLimite[0] || hoy;

      // Construir descripción consolidada
      const rutinasList = grupo.ordenes
        .map(o => `• [${o.ciclo}] ${o.rubro_nombre} — ${o.rutina_objeto}${o.requiere_informe_matriculado ? ' ⚠ Matriculado' : ''}${o.carga_sismesc ? ' 📋 SISMESC' : ''}`)
        .join('\n');

      const vencidas = grupo.ordenes.filter(o => o.estado === 'vencida').length;
      const urgencia = vencidas > 0 ? `⚠ ${vencidas} rutina(s) VENCIDA(S)\n\n` : '';

      const description = [
        `${urgencia}Orden de mantenimiento preventivo generada automáticamente desde el Módulo de Rutinas (Anexo 3 PETP — DGMESC).`,
        ``,
        `Edificio: ${grupo.edificio_nombre}`,
        jefeSitio ? `Jefe de Sitio: ${jefeSitio}` : '',
        `Total de rutinas pendientes: ${grupo.ordenes.length}`,
        `Fecha límite más próxima: ${fechaLimite}`,
        ``,
        `RUTINAS INCLUIDAS:`,
        rutinasList,
      ].filter(l => l !== undefined).join('\n');

      const ot = await base44.entities.WorkOrder.create({
        title: `[Rutinas] ${grupo.edificio_nombre} — ${grupo.ordenes.length} rutinas pendientes`,
        type: 'mantenimiento_preventivo',
        status: 'pendiente',
        priority: vencidas > 0 ? 'urgente' : grupo.ordenes.length >= 5 ? 'alta' : 'media',
        description,
        location: grupo.edificio_nombre,
        assigned_name: jefeSitio || undefined,
        scheduled_date: fechaLimite,
      });

      // Vincular todas las OrdenesRutina a esta OT y cambiar estado a en_proceso
      await Promise.all(
        grupo.ordenes.map(o =>
          base44.entities.OrdenRutina.update(o.id, {
            work_order_id: ot.id,
            estado: o.estado === 'vencida' ? 'vencida' : 'en_proceso',
          })
        )
      );

      setGenerados(prev => ({ ...prev, [key]: ot.id }));
      toast.success(`OT generada para ${grupo.edificio_nombre}`);
      qc.invalidateQueries({ queryKey: ['ordenes-rutina-pendientes-ot'] });
      qc.invalidateQueries({ queryKey: ['ordenes-rutina'] });

    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setGenerando(prev => ({ ...prev, [key]: false }));
    }
  };

  const generarTodas = async () => {
    for (const grupo of grupos) {
      const key = grupo.edificio_id || grupo.edificio_nombre;
      if (generados[key]) continue;
      await generarOTParaEdificio(grupo);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  const totalOrdenes = ordenes.length;
  const totalEdificios = grupos.length;
  const totalVencidas = ordenes.filter(o => o.estado === 'vencida').length;

  return (
    <div className="space-y-5">
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Edificios con rutinas pendientes', value: totalEdificios, color: '#60a5fa' },
          { label: 'Rutinas sin OT asignada', value: totalOrdenes, color: '#facc15' },
          { label: 'Rutinas vencidas', value: totalVencidas, color: '#f87171' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
            <p className="text-xs text-white/50 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {totalOrdenes === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-400 mb-3" />
          <p className="text-white font-semibold">Todas las rutinas tienen OT asignada</p>
          <p className="text-sm text-white/40 mt-1">No hay rutinas pendientes sin orden de trabajo.</p>
        </div>
      ) : (
        <>
          {/* Botón generar todas */}
          <div className="flex justify-end">
            <Button
              onClick={generarTodas}
              className="gap-2 font-bold"
              style={{ background: '#D4AF37', color: '#0A2540' }}
            >
              <Send className="h-4 w-4" />
              Generar OT a todos los jefes de sitio ({totalEdificios})
            </Button>
          </div>

          {/* Lista por edificio */}
          <div className="space-y-2">
            {grupos.map(grupo => {
              const key = grupo.edificio_id || grupo.edificio_nombre;
              const isExpanded = expandedEdificio === key;
              const isGenerando = generando[key];
              const otGenerada = generados[key];
              const vencidasGrupo = grupo.ordenes.filter(o => o.estado === 'vencida').length;
              const edificio = edificioMap[grupo.edificio_id];

              return (
                <div key={key} className="rounded-xl border border-white/10 overflow-hidden">
                  {/* Fila edificio */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                    onClick={() => setExpandedEdificio(isExpanded ? null : key)}
                  >
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 text-white/40 flex-shrink-0" />
                      : <ChevronRight className="h-4 w-4 text-white/40 flex-shrink-0" />
                    }
                    <Building2 className="h-4 w-4 text-white/50 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{grupo.edificio_nombre}</p>
                      {edificio?.jefe_sitio && (
                        <p className="text-xs text-white/40">Jefe: {edificio.jefe_sitio}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline" className="text-[10px] text-white/60 border-white/20">
                        {grupo.ordenes.length} rutinas
                      </Badge>
                      {vencidasGrupo > 0 && (
                        <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-400 bg-red-500/10">
                          <AlertTriangle className="h-3 w-3 mr-1" />{vencidasGrupo} vencidas
                        </Badge>
                      )}
                      {otGenerada ? (
                        <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10 gap-1">
                          <CheckCircle2 className="h-3 w-3" /> OT generada
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={e => { e.stopPropagation(); generarOTParaEdificio(grupo); }}
                          disabled={isGenerando}
                          className="h-7 text-xs gap-1.5 font-semibold"
                          style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}
                        >
                          {isGenerando
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Wrench className="h-3 w-3" />
                          }
                          {isGenerando ? 'Generando…' : 'Generar OT'}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Detalle expandido */}
                  {isExpanded && (
                    <div className="border-t border-white/10 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                            {['Rubro', 'Rutina', 'Ciclo', 'Estado', 'Vence'].map(h => (
                              <th key={h} className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-white/40 font-semibold">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {grupo.ordenes.map(o => (
                            <tr key={o.id} className="hover:bg-white/3">
                              <td className="px-4 py-2 text-white/50 max-w-28 truncate">{o.rubro_nombre}</td>
                              <td className="px-4 py-2 text-white font-medium max-w-56 truncate">
                                {o.rutina_objeto}
                                {o.requiere_informe_matriculado && <span className="ml-1 text-amber-400">⚠</span>}
                                {o.carga_sismesc && <span className="ml-1 text-blue-400">📋</span>}
                              </td>
                              <td className="px-4 py-2 text-white/50">{o.ciclo}</td>
                              <td className="px-4 py-2">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  o.estado === 'vencida'
                                    ? 'bg-red-500/20 text-red-300'
                                    : 'bg-yellow-500/20 text-yellow-300'
                                }`}>
                                  {o.estado === 'vencida' ? 'Vencida' : 'Pendiente'}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-white/50 tabular-nums">{o.fecha_limite || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}