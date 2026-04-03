import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BarChart2, TrendingUp, Clock, Package, Wrench, CheckCircle2, AlertTriangle, Download, Filter, FileText } from 'lucide-react';
import { exportKPIsPDF } from '@/utils/exportPDF';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import PageHeader from '@/components/shared/PageHeader';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

function KpiMetric({ title, value, subtitle, icon: IconComponent, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600', green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-600', purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}>
          {IconComponent && <IconComponent className="h-5 w-5" />}
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm font-medium">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}

export default function Reportes() {
  const [dateFrom, setDateFrom] = useState(format(subMonths(new Date(), 5), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [projectFilter, setProjectFilter] = useState('all');

  const { data: orders = [] } = useQuery({ queryKey: ['workorders'], queryFn: () => base44.entities.WorkOrder.list() });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list() });
  const { data: timeLogs = [] } = useQuery({ queryKey: ['timelogs_all'], queryFn: () => base44.entities.TimeLog.list() });
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: () => base44.entities.Material.list() });
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => base44.entities.Asset.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => base44.entities.Invoice.list() });

  const filteredOrders = useMemo(() => {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    return orders.filter(o => {
      const date = o.created_date ? new Date(o.created_date) : null;
      const inRange = !date || (date >= from && date <= to);
      const inProject = projectFilter === 'all' || o.project_name === projectFilter;
      return inRange && inProject;
    });
  }, [orders, dateFrom, dateTo, projectFilter]);

  // OTs por mes
  const months = eachMonthOfInterval({ start: new Date(dateFrom), end: new Date(dateTo) });
  const otsPorMes = months.map(month => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const monthOrders = orders.filter(o => {
      const d = o.created_date ? new Date(o.created_date) : null;
      return d && isWithinInterval(d, { start, end });
    });
    return {
      mes: format(month, 'MMM yy', { locale: es }),
      total: monthOrders.length,
      completadas: monthOrders.filter(o => o.status === 'completada').length,
      pendientes: monthOrders.filter(o => ['pendiente', 'asignada'].includes(o.status)).length,
    };
  });

  // OTs por tipo
  const typeLabels = {
    mantenimiento_preventivo: 'Preventivo', mantenimiento_correctivo: 'Correctivo',
    instalacion: 'Instalación', inspeccion: 'Inspección', reparacion: 'Reparación', emergencia: 'Emergencia'
  };
  const otsPorTipo = Object.entries(typeLabels).map(([key, label]) => ({
    name: label,
    value: filteredOrders.filter(o => o.type === key).length,
  })).filter(d => d.value > 0);

  // OTs por prioridad
  const otsPorPrioridad = ['urgente', 'alta', 'media', 'baja'].map(p => ({
    prioridad: p.charAt(0).toUpperCase() + p.slice(1),
    cantidad: filteredOrders.filter(o => o.priority === p).length,
  }));

  // Horas por empleado (top 8)
  const horasPorEmpleado = Object.entries(
    timeLogs.reduce((acc, log) => {
      acc[log.employee_name] = (acc[log.employee_name] || 0) + (log.hours || 0);
      return acc;
    }, {})
  ).map(([name, hours]) => ({ name, hours }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 8);

  // Costo materiales por categoría
  const costoMateriales = Object.entries(
    orders.flatMap(o => o.materials_used || []).reduce((acc, m) => {
      acc[m.material_name] = (acc[m.material_name] || 0) + (m.quantity * m.unit_cost || 0);
      return acc;
    }, {})
  ).map(([name, costo]) => ({ name, costo }))
    .sort((a, b) => b.costo - a.costo)
    .slice(0, 6);

  // KPIs generales
  const completadas = filteredOrders.filter(o => o.status === 'completada').length;
  const eficiencia = filteredOrders.length > 0 ? Math.round((completadas / filteredOrders.length) * 100) : 0;
  const totalHoras = timeLogs.reduce((s, l) => s + (l.hours || 0), 0);
  const costoTotalMateriales = orders.reduce((s, o) =>
    s + (o.materials_used || []).reduce((ms, m) => ms + (m.quantity * m.unit_cost || 0), 0), 0);
  const tiempoPromedio = (() => {
    const conHoras = filteredOrders.filter(o => o.actual_hours > 0);
    if (!conHoras.length) return 0;
    return Math.round(conHoras.reduce((s, o) => s + o.actual_hours, 0) / conHoras.length * 10) / 10;
  })();

  const exportCSV = () => {
    const rows = [
      ['Código', 'Título', 'Tipo', 'Estado', 'Prioridad', 'Asignado', 'Fecha Programada', 'Horas Estimadas', 'Horas Reales'],
      ...filteredOrders.map(o => [
        o.code || '', o.title, o.type, o.status, o.priority, o.assigned_name || '',
        o.scheduled_date || '', o.estimated_hours || '', o.actual_hours || ''
      ])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `reporte_ots_${format(new Date(), 'yyyyMMdd')}.csv`; a.click();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes & Analíticas"
        subtitle="Métricas operacionales y financieras para Mejores"
      />

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Filtros del Reporte</span>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Desde</p>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs w-36" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Hasta</p>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs w-36" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Proyecto</p>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="h-8 text-xs w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los proyectos</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.name} className="text-xs">{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs border-red-300 text-red-700 hover:bg-red-50" onClick={() => exportKPIsPDF({ orders: filteredOrders, timeLogs, materials, assets, dateFrom, dateTo })}>
              <FileText className="h-3.5 w-3.5" /> PDF KPIs
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiMetric title="OTs en Período" value={filteredOrders.length} subtitle={`${completadas} completadas`} icon={Wrench} color="blue" />
        <KpiMetric title="Tasa de Cumplimiento" value={`${eficiencia}%`} subtitle="OTs completadas / totales" icon={CheckCircle2} color="green" />
        <KpiMetric title="Horas Registradas" value={`${totalHoras}h`} subtitle={`Prom. ${tiempoPromedio}h/OT`} icon={Clock} color="purple" />
        <KpiMetric title="Costo en Materiales" value={fmt(costoTotalMateriales)} subtitle="Todas las OTs" icon={Package} color="amber" />
      </div>

      <Tabs defaultValue="ots">
        <TabsList>
          <TabsTrigger value="ots" className="gap-1.5"><BarChart2 className="h-3.5 w-3.5" /> OTs</TabsTrigger>
          <TabsTrigger value="horas" className="gap-1.5"><Clock className="h-3.5 w-3.5" /> Horas</TabsTrigger>
          <TabsTrigger value="materiales" className="gap-1.5"><Package className="h-3.5 w-3.5" /> Materiales</TabsTrigger>
          <TabsTrigger value="activos" className="gap-1.5"><Wrench className="h-3.5 w-3.5" /> Activos</TabsTrigger>
        </TabsList>

        {/* OTs Tab */}
        <TabsContent value="ots" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">OTs por Mes</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={otsPorMes}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="completadas" fill="#10b981" name="Completadas" radius={[3,3,0,0]} />
                    <Bar dataKey="pendientes" fill="#94a3b8" name="Pendientes" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">OTs por Tipo</CardTitle></CardHeader>
              <CardContent className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={otsPorTipo} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {otsPorTipo.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm">OTs por Prioridad</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={otsPorPrioridad} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis dataKey="prioridad" type="category" tick={{ fontSize: 11 }} width={70} />
                    <Tooltip />
                    <Bar dataKey="cantidad" fill="#2563eb" name="Cantidad" radius={[0,3,3,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Horas Tab */}
        <TabsContent value="horas" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Horas por Técnico</CardTitle></CardHeader>
            <CardContent>
              {horasPorEmpleado.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">Sin registros de horas</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={horasPorEmpleado}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${v}h`, 'Horas']} />
                    <Bar dataKey="hours" fill="#8b5cf6" name="Horas" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Tabla detalle horas */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Detalle de Registros</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {timeLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Sin registros de horas</p>
                ) : timeLogs.slice(0, 50).map(log => (
                  <div key={log.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 text-xs">
                    <span className="font-medium flex-1">{log.employee_name}</span>
                    <span className="text-muted-foreground truncate max-w-[160px]">{log.work_order_title}</span>
                    <span className="text-muted-foreground">{log.date ? format(parseISO(log.date), 'd MMM', { locale: es }) : ''}</span>
                    <span className="font-bold text-primary w-10 text-right">{log.hours}h</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Materiales Tab */}
        <TabsContent value="materiales" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Top Materiales Utilizados</CardTitle></CardHeader>
              <CardContent>
                {costoMateriales.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">Sin datos de materiales</div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={costoMateriales} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip formatter={(v) => [fmt(v), 'Costo']} />
                      <Bar dataKey="costo" fill="#f59e0b" radius={[0,3,3,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Stock Actual vs Mínimo</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {materials.filter(m => m.min_stock > 0).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Sin materiales con stock mínimo definido</p>
                  ) : materials.filter(m => m.min_stock > 0).map(m => {
                    const pct = m.min_stock > 0 ? Math.min((m.stock / m.min_stock) * 100, 100) : 100;
                    const low = m.stock <= m.min_stock;
                    return (
                      <div key={m.id} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium truncate max-w-[160px]">{m.name}</span>
                          <span className={`font-medium ${low ? 'text-red-600' : 'text-emerald-600'}`}>
                            {m.stock} / {m.min_stock}
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${low ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Activos Tab */}
        <TabsContent value="activos" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Activos por Estado</CardTitle></CardHeader>
              <CardContent className="flex justify-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Operativo', value: assets.filter(a => a.status === 'operativo').length },
                        { name: 'Mantenimiento', value: assets.filter(a => a.status === 'en_mantenimiento').length },
                        { name: 'Fuera servicio', value: assets.filter(a => a.status === 'fuera_de_servicio').length },
                        { name: 'Baja', value: assets.filter(a => a.status === 'baja').length },
                      ].filter(d => d.value > 0)}
                      dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {[0,1,2,3].map(idx => <Cell key={idx} fill={[COLORS[2], COLORS[0], COLORS[3], '#94a3b8'][idx]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Activos por Criticidad</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3 pt-2">
                  {[
                    { label: 'Crítica', key: 'critica', color: 'bg-red-500' },
                    { label: 'Alta', key: 'alta', color: 'bg-orange-500' },
                    { label: 'Media', key: 'media', color: 'bg-blue-500' },
                    { label: 'Baja', key: 'baja', color: 'bg-slate-400' },
                  ].map(({ label, key, color }) => {
                    const count = assets.filter(a => a.criticality === key).length;
                    const pct = assets.length > 0 ? (count / assets.length) * 100 : 0;
                    return (
                      <div key={key}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium">{label}</span>
                          <span className="text-muted-foreground">{count} activos ({Math.round(pct)}%)</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Activos con Mantenimiento Vencido o Próximo</CardTitle>
                  <span className="text-xs text-muted-foreground">{assets.filter(a => a.next_maintenance).length} programados</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {assets.filter(a => a.next_maintenance).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Sin mantenimientos programados</p>
                  ) : assets
                    .filter(a => a.next_maintenance)
                    .sort((a, b) => a.next_maintenance.localeCompare(b.next_maintenance))
                    .map(asset => {
                      const days = Math.ceil((new Date(asset.next_maintenance) - new Date()) / (1000 * 60 * 60 * 24));
                      const overdue = days < 0;
                      const soon = days >= 0 && days <= 30;
                      return (
                        <div key={asset.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 text-xs">
                          {overdue ? <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" /> : <Wrench className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                          <span className="font-medium flex-1">{asset.name}</span>
                          <span className="text-muted-foreground">{asset.location}</span>
                          <span className={`font-medium px-2 py-0.5 rounded ${overdue ? 'bg-red-100 text-red-700' : soon ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {overdue ? `Vencido ${Math.abs(days)}d` : days === 0 ? 'Hoy' : `En ${days}d`}
                          </span>
                        </div>
                      );
                    })
                  }
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}