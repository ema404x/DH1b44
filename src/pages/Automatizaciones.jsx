import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Zap, Bell, Wrench, Package, ClipboardList, CheckCircle2,
  Play, RefreshCw, Clock, AlertTriangle, ShieldAlert,
  ArrowRight, Calendar, Settings
} from 'lucide-react';
import { isPast, parseISO, format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';
import { Link } from 'react-router-dom';

const TIPO_INFO = {
  garantia_activo:   { label: 'Garantía de Activos', icon: ShieldAlert, color: 'text-purple-400', bg: 'bg-purple-500/10', badge: 'bg-purple-500/20 text-purple-300' },
  stock_material:    { label: 'Stock Crítico',         icon: Package,      color: 'text-red-400',    bg: 'bg-red-500/10',    badge: 'bg-red-500/20 text-red-300' },
  pendiente_vencido: { label: 'Pendientes Vencidos',   icon: Clock,        color: 'text-amber-400',  bg: 'bg-amber-500/10',  badge: 'bg-amber-500/20 text-amber-300' },
  ot_vencida:        { label: 'OTs Vencidas',           icon: ClipboardList,color: 'text-orange-400', bg: 'bg-orange-500/10', badge: 'bg-orange-500/20 text-orange-300' },
};

const NIVEL_STYLE = {
  critical: 'bg-red-500/20 text-red-300 border border-red-500/30',
  warning:  'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  info:     'bg-blue-500/20 text-blue-300 border border-blue-500/30',
};

const fmtDate = (d) => {
  try { return d ? format(new Date(d), "d 'de' MMM HH:mm", { locale: es }) : '-'; } catch { return '-'; }
};

export default function Automatizaciones() {
  const [running, setRunning] = useState(false);
  const qc = useQueryClient();

  // Automatizaciones del sistema (hard-coded display - datos reales del scheduler)
  const AUTOMATIZACIONES_SISTEMA = [
    { nombre: 'Chequeo diario de alertas proactivas', funcion: 'checkAlertas', horario: 'Diario 8:00 AM', runs: 18, estado: 'activo' },
    { nombre: 'Generar Certificados Mensuales', funcion: 'generateMonthlyCertificates', horario: 'Diario 8:00 AM (cron)', runs: 27, estado: 'activo' },
    { nombre: 'Detección de Patrones de Emergencias', funcion: 'detectarPatronesEmergencias', horario: 'Diario 10:00 AM', runs: 0, estado: 'activo' },
    { nombre: 'Resumen Semanal por Email', funcion: 'resumenSemanal', horario: 'Lunes 8:00 AM', runs: 0, estado: 'activo' },
  ];

  const { data: orders = [] } = useQuery({ queryKey: ['workorders'], queryFn: () => base44.entities.WorkOrder.list() });
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: () => base44.entities.Material.list() });
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list() });
  const { data: configs = [] } = useQuery({ queryKey: ['alerta-configs'], queryFn: () => base44.entities.AlertaConfig.list() });
  const { data: logs = [] } = useQuery({ queryKey: ['alerta-logs'], queryFn: () => base44.entities.AlertaLog.list('-fecha_alerta', 30) });

  const activeConfigs = configs.filter(c => c.activo);

  const runCheck = async () => {
    setRunning(true);
    try {
      const res = await base44.functions.invoke('checkAlertas', {});
      if (res.data?.success) {
        const total = res.data.totalAlertas;
        toast.success(total > 0
          ? `${total} nueva${total !== 1 ? 's' : ''} alerta${total !== 1 ? 's' : ''} detectada${total !== 1 ? 's' : ''}`
          : 'Todo al día — sin alertas nuevas'
        );
        qc.invalidateQueries({ queryKey: ['alerta-logs'] });
        qc.invalidateQueries({ queryKey: ['alerta-configs'] });
        qc.invalidateQueries({ queryKey: ['alertas-activas'] });
      } else {
        toast.error(res.data?.error || 'Error al ejecutar');
      }
    } catch (err) {
      toast.error(err.message);
    }
    setRunning(false);
  };

  // Métricas en tiempo real
  const statsEnTiempoReal = [
    {
      label: 'OTs vencidas',
      value: orders.filter(o => o.scheduled_date && isPast(parseISO(o.scheduled_date)) && !['completada','cancelada'].includes(o.status)).length,
      icon: ClipboardList, color: 'text-orange-400', bg: 'bg-orange-500/10', href: '/ordenes',
    },
    {
      label: 'Stock bajo mínimo',
      value: materials.filter(m => m.min_stock > 0 && m.stock <= m.min_stock).length,
      icon: Package, color: 'text-red-400', bg: 'bg-red-500/10', href: '/inventario',
    },
    {
      label: 'Mant. vencidos',
      value: assets.filter(a => a.next_maintenance && isPast(new Date(a.next_maintenance))).length,
      icon: Wrench, color: 'text-purple-400', bg: 'bg-purple-500/10', href: '/activos',
    },
    {
      label: 'Alertas activas',
      value: logs.filter(l => !l.leida).length,
      icon: Bell, color: 'text-amber-400', bg: 'bg-amber-500/10', href: '/alertas',
    },
  ];

  const logsRecientes = logs.slice(0, 20);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automatizaciones"
        subtitle="Motor de alertas proactivas y monitoreo del sistema"
      />

      {/* Stats en tiempo real */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statsEnTiempoReal.map(s => (
          <Link key={s.label} to={s.href}>
            <Card className="hover:border-border/80 transition-colors cursor-pointer">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                    <s.icon className={`h-4 w-4 ${s.color}`} />
                  </div>
                  <div>
                    <div className={`text-2xl font-bold ${s.value > 0 ? s.color : 'text-foreground'}`}>{s.value}</div>
                    <div className="text-[11px] text-muted-foreground leading-tight">{s.label}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel izquierdo: Reglas activas */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Reglas Activas
                  <Badge variant="secondary" className="text-[10px]">{activeConfigs.length} configuradas</Badge>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Link to="/alertas">
                    <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs">
                      <Settings className="h-3.5 w-3.5" />
                      Configurar
                    </Button>
                  </Link>
                  <Button size="sm" className="gap-1.5 h-8" onClick={runCheck} disabled={running}>
                    {running ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    {running ? 'Ejecutando...' : 'Ejecutar ahora'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {activeConfigs.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <Bell className="h-8 w-8 mx-auto text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No hay reglas configuradas.</p>
                  <Link to="/alertas">
                    <Button size="sm" variant="outline" className="gap-2">
                      <Settings className="h-3.5 w-3.5" /> Ir a Configuración de Alertas
                    </Button>
                  </Link>
                </div>
              ) : (
                activeConfigs.map(cfg => {
                  const info = TIPO_INFO[cfg.tipo] || TIPO_INFO.pendiente_vencido;
                  const Icon = info.icon;
                  const logsCfg = logs.filter(l => l.config_id === cfg.id && !l.leida);
                  return (
                    <div key={cfg.id} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/20 transition-colors">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${info.bg}`}>
                        <Icon className={`h-4 w-4 ${info.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{cfg.nombre}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${info.badge}`}>
                            {info.label}
                          </span>
                        </div>
                        {cfg.ultima_notificacion && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            Última ejecución: {fmtDate(cfg.ultima_notificacion)}
                          </p>
                        )}
                      </div>
                      {logsCfg.length > 0 && (
                        <Badge className="bg-red-500/20 text-red-300 border border-red-500/30 text-[10px]">
                          {logsCfg.length} activa{logsCfg.length !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Automatizaciones del sistema */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Automatizaciones Programadas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {AUTOMATIZACIONES_SISTEMA.map(auto => (
                <div key={auto.funcion} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-muted/20 transition-colors">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{auto.nombre}</p>
                    <p className="text-[10px] text-muted-foreground">{auto.horario} · {auto.runs} ejecuciones</p>
                  </div>
                  <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400 flex-shrink-0">activo</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Panel derecho: Log reciente */}
        <div>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  Alertas Recientes
                </CardTitle>
                <Link to="/alertas">
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground">
                    Ver todas <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {logsRecientes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Sin alertas recientes</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                  {logsRecientes.map(log => {
                    const info = TIPO_INFO[log.tipo] || TIPO_INFO.pendiente_vencido;
                    const Icon = info.icon;
                    return (
                      <div key={log.id} className={`flex items-start gap-2.5 p-2.5 rounded-lg border border-border/50 ${log.leida ? 'opacity-50' : ''}`}>
                        <Icon className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${info.color}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium leading-tight">{log.titulo}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{log.entidad_nombre}</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">{fmtDate(log.fecha_alerta)}</p>
                        </div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${NIVEL_STYLE[log.nivel] || NIVEL_STYLE.warning}`}>
                          {log.nivel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}