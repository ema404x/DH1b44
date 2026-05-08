import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Download, FileText, TrendingUp, Users, Database, Trash2, Plus, Edit3, Eye, Shield, Clock, ChevronDown, ChevronRight, Activity, BarChart3, X } from 'lucide-react';
import { format, formatDistanceToNow, subDays, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const ACTION_CONFIG = {
  create: { label: 'Creación', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400', icon: Plus },
  update: { label: 'Edición', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', dot: 'bg-blue-400', icon: Edit3 },
  delete: { label: 'Eliminación', color: 'bg-red-500/15 text-red-400 border-red-500/30', dot: 'bg-red-400', icon: Trash2 },
  view:   { label: 'Vista', color: 'bg-slate-500/15 text-slate-400 border-slate-500/30', dot: 'bg-slate-400', icon: Eye },
  sign:   { label: 'Firma', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30', dot: 'bg-purple-400', icon: Shield },
};

const ENTITY_LABELS = {
  WorkOrder: 'Orden de Trabajo', Certificado: 'Certificado', Employee: 'Empleado',
  Client: 'Proveedor', Project: 'Proyecto', SolicitudCertificado: 'Solicitud de Certificado',
  Emergencia: 'Emergencia', RolePermission: 'Permiso de Rol', AbonoMaestro: 'Abono Maestro',
  Material: 'Material', Asset: 'Activo', InspeccionColegio: 'Inspección',
};

const PIE_COLORS = ['#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#94a3b8'];

function FieldDiff({ field, oldVal, newVal }) {
  const fmt = (v) => {
    if (v === null || v === undefined) return <span className="italic text-slate-500">vacío</span>;
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';
    if (typeof v === 'object') return JSON.stringify(v).slice(0, 60) + '...';
    return String(v);
  };
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-xs py-1.5 border-b border-slate-800 last:border-0">
      <div className="font-mono text-slate-300">{field}</div>
      <ChevronRight className="h-3 w-3 text-slate-600" />
      <div className="flex gap-2">
        <span className="line-through text-red-400/70 truncate">{fmt(oldVal)}</span>
        <span className="text-emerald-400 truncate">{fmt(newVal)}</span>
      </div>
    </div>
  );
}

function LogCard({ log }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = ACTION_CONFIG[log.action] || ACTION_CONFIG.view;
  const Icon = cfg.icon;
  const entityLabel = ENTITY_LABELS[log.entity_type] || log.entity_type;
  const hasDetail = log.changed_fields?.length > 0 || log.notes;

  return (
    <div className="relative pl-8">
      {/* Timeline dot */}
      <div className={`absolute left-2 top-4 h-3 w-3 rounded-full ${cfg.dot} ring-4 ring-background`} />

      <Card className="p-4 bg-slate-800/40 border-slate-700/50 hover:border-slate-600/50 transition-all">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`text-xs border ${cfg.color}`}>{cfg.label}</Badge>
                <span className="font-semibold text-sm text-white">{entityLabel}</span>
                <span className="text-xs text-slate-500 font-mono bg-slate-800 px-1.5 py-0.5 rounded">{log.entity_id?.slice(0, 10)}…</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-400">
                <span>👤 {log.user_email}</span>
                {log.user_role && log.user_role !== 'sistema' && <span>🎭 {log.user_role}</span>}
                {log.changed_fields?.length > 0 && (
                  <span className="text-blue-400">📝 {log.changed_fields.length} campo{log.changed_fields.length > 1 ? 's' : ''} modificado{log.changed_fields.length > 1 ? 's' : ''}</span>
                )}
              </div>

              {/* Diff expandible */}
              {hasDetail && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="mt-2 text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
                >
                  {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {expanded ? 'Ocultar detalle' : 'Ver detalle'}
                </button>
              )}

              {expanded && (
                <div className="mt-3 p-3 bg-slate-900/60 rounded-lg border border-slate-700/50">
                  {log.changed_fields?.length > 0 && log.old_values && log.new_values && (
                    <div className="space-y-0">
                      {log.changed_fields.map(field => (
                        <FieldDiff
                          key={field}
                          field={field}
                          oldVal={log.old_values[field]}
                          newVal={log.new_values[field]}
                        />
                      ))}
                    </div>
                  )}
                  {log.changed_fields?.length > 0 && (!log.old_values || !log.new_values) && (
                    <div className="flex flex-wrap gap-1">
                      {log.changed_fields.map(f => (
                        <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
                      ))}
                    </div>
                  )}
                  {log.notes && (
                    <p className="text-xs text-slate-400 italic mt-2">{log.notes}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-500 text-right whitespace-nowrap flex-shrink-0">
            <div>{format(new Date(log.timestamp), 'dd/MM HH:mm', { locale: es })}</div>
            <div className="text-slate-600">{formatDistanceToNow(new Date(log.timestamp), { locale: es })} atrás</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function TimelineView({ logs }) {
  // Agrupar por día
  const grouped = useMemo(() => {
    const groups = {};
    logs.forEach(log => {
      const day = format(new Date(log.timestamp), 'yyyy-MM-dd');
      if (!groups[day]) groups[day] = [];
      groups[day].push(log);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [logs]);

  if (logs.length === 0) return (
    <Card className="p-12 text-center bg-slate-800/40 border-slate-700/50">
      <FileText className="h-8 w-8 text-slate-600 mx-auto mb-3" />
      <p className="text-slate-500 text-sm">No hay registros que coincidan con los filtros</p>
    </Card>
  );

  return (
    <div className="space-y-6">
      {grouped.map(([day, dayLogs]) => (
        <div key={day}>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-xs font-semibold text-slate-500 px-2 py-1 bg-slate-800/60 rounded-full">
              {format(new Date(day), "EEEE d 'de' MMMM", { locale: es })}
              <span className="ml-2 text-slate-600">({dayLogs.length})</span>
            </span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>
          <div className="border-l-2 border-slate-800 ml-3 space-y-3">
            {dayLogs.map(log => <LogCard key={log.id} log={log} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsView({ logs }) {
  const byAction = useMemo(() => {
    const map = {};
    logs.forEach(l => { map[l.action] = (map[l.action] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name: ACTION_CONFIG[name]?.label || name, value }));
  }, [logs]);

  const byEntity = useMemo(() => {
    const map = {};
    logs.forEach(l => { map[l.entity_type] = (map[l.entity_type] || 0) + 1; });
    return Object.entries(map).sort(([,a],[,b]) => b - a).slice(0, 8).map(([name, value]) => ({
      name: ENTITY_LABELS[name] || name, value
    }));
  }, [logs]);

  const byUser = useMemo(() => {
    const map = {};
    logs.forEach(l => { map[l.user_email] = (map[l.user_email] || 0) + 1; });
    return Object.entries(map).sort(([,a],[,b]) => b - a).slice(0, 5);
  }, [logs]);

  const byDay = useMemo(() => {
    const map = {};
    for (let i = 6; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'dd/MM');
      map[d] = 0;
    }
    logs.forEach(l => {
      if (isAfter(new Date(l.timestamp), subDays(new Date(), 7))) {
        const d = format(new Date(l.timestamp), 'dd/MM');
        if (map[d] !== undefined) map[d]++;
      }
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [logs]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5 bg-slate-800/40 border-slate-700/50">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Actividad últimos 7 días</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byDay}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" fill="#3b82f6" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 bg-slate-800/40 border-slate-700/50">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Distribución por tipo de acción</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={byAction} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
                  {byAction.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {byAction.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-slate-300">{item.name}</span>
                  </div>
                  <span className="font-bold text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5 bg-slate-800/40 border-slate-700/50">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Database className="h-4 w-4 text-primary" /> Módulos más activos</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byEntity} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={110} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" fill="#10b981" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 bg-slate-800/40 border-slate-700/50">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Usuarios más activos</h3>
          <div className="space-y-3">
            {byUser.map(([email, count], i) => (
              <div key={email} className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200 truncate">{email}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(count / (byUser[0]?.[1] || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">{count}</span>
                  </div>
                </div>
              </div>
            ))}
            {byUser.length === 0 && <p className="text-sm text-slate-500 text-center py-4">Sin datos</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function Auditoria() {
  const [filters, setFilters] = useState({ entity_type: '', action: '', user_email: '' });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['auditLogs', filters],
    queryFn: async () => {
      const query = {};
      if (filters.entity_type) query.entity_type = filters.entity_type;
      if (filters.action) query.action = filters.action;
      if (filters.user_email) query.user_email = filters.user_email;
      return await base44.entities.AuditLog.filter(query, '-timestamp', 500);
    }
  });

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (dateFrom && new Date(log.timestamp) < new Date(dateFrom)) return false;
      if (dateTo && new Date(log.timestamp) > new Date(dateTo + 'T23:59:59')) return false;
      if (search) {
        const s = search.toLowerCase();
        const matchId = log.entity_id?.toLowerCase().includes(s);
        const matchType = log.entity_type?.toLowerCase().includes(s);
        const matchUser = log.user_email?.toLowerCase().includes(s);
        const matchFields = log.changed_fields?.some(f => f.toLowerCase().includes(s));
        if (!matchId && !matchType && !matchUser && !matchFields) return false;
      }
      return true;
    });
  }, [logs, dateFrom, dateTo, search]);

  const stats = useMemo(() => ({
    total: filteredLogs.length,
    creates: filteredLogs.filter(l => l.action === 'create').length,
    updates: filteredLogs.filter(l => l.action === 'update').length,
    deletes: filteredLogs.filter(l => l.action === 'delete').length,
    users: new Set(filteredLogs.map(l => l.user_email)).size,
  }), [filteredLogs]);

  const hasFilters = filters.entity_type || filters.action || filters.user_email || dateFrom || dateTo || search;

  const exportCSV = () => {
    const csv = [
      ['Fecha', 'Usuario', 'Rol', 'Entidad', 'ID', 'Acción', 'Campos Modificados', 'Notas'].join(','),
      ...filteredLogs.map(log => [
        format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: es }),
        log.user_email,
        log.user_role,
        log.entity_type,
        log.entity_id,
        log.action,
        (log.changed_fields || []).join(';'),
        log.notes || ''
      ].map(f => `"${String(f).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            Auditoría
          </h1>
          <p className="text-slate-400 mt-1">Registro completo de todas las acciones del sistema</p>
        </div>
        <Button onClick={exportCSV} variant="outline" className="gap-2 border-slate-700/50 bg-slate-800/50 text-white hover:bg-slate-700/50">
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: Clock, color: 'text-slate-300' },
          { label: 'Creaciones', value: stats.creates, icon: Plus, color: 'text-emerald-400' },
          { label: 'Ediciones', value: stats.updates, icon: Edit3, color: 'text-blue-400' },
          { label: 'Eliminaciones', value: stats.deletes, icon: Trash2, color: 'text-red-400' },
          { label: 'Usuarios', value: stats.users, icon: Users, color: 'text-violet-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="p-4 bg-slate-800/40 border-slate-700/50">
            <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
            <div className="flex items-end justify-between mt-1">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <Icon className={`h-4 w-4 ${color} opacity-50`} />
            </div>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card className="p-4 bg-slate-800/40 border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300">Filtros</h3>
          {hasFilters && (
            <button onClick={() => { setFilters({ entity_type: '', action: '', user_email: '' }); setDateFrom(''); setDateTo(''); setSearch(''); }}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              <X className="h-3 w-3" /> Limpiar
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm bg-slate-900/50 border-slate-700" />
          </div>
          <Input placeholder="Módulo (WorkOrder...)" value={filters.entity_type} onChange={e => setFilters({...filters, entity_type: e.target.value})} className="h-8 text-sm bg-slate-900/50 border-slate-700" />
          <Select value={filters.action || 'all'} onValueChange={v => setFilters({...filters, action: v === 'all' ? '' : v})}>
            <SelectTrigger className="h-8 text-sm bg-slate-900/50 border-slate-700"><SelectValue placeholder="Acción" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las acciones</SelectItem>
              <SelectItem value="create">Creación</SelectItem>
              <SelectItem value="update">Edición</SelectItem>
              <SelectItem value="delete">Eliminación</SelectItem>
              <SelectItem value="sign">Firma</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-sm bg-slate-900/50 border-slate-700" />
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-sm bg-slate-900/50 border-slate-700" />
        </div>
      </Card>

      {/* Tabs */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-500">
          <div className="w-6 h-6 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin mx-auto mb-3" />
          Cargando registros...
        </div>
      ) : (
        <Tabs defaultValue="timeline">
          <TabsList className="bg-slate-800/60 border border-slate-700/50">
            <TabsTrigger value="timeline" className="gap-2 data-[state=active]:bg-slate-700">
              <Clock className="h-3.5 w-3.5" /> Timeline ({filteredLogs.length})
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-2 data-[state=active]:bg-slate-700">
              <TrendingUp className="h-3.5 w-3.5" /> Estadísticas
            </TabsTrigger>
          </TabsList>
          <TabsContent value="timeline" className="mt-4">
            <TimelineView logs={filteredLogs} />
          </TabsContent>
          <TabsContent value="stats" className="mt-4">
            <StatsView logs={filteredLogs} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}