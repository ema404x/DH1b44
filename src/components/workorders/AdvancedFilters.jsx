import React, { useMemo } from 'react';
import { Filter, X, ChevronDown, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const PRIORIDADES = [
  { value: '', label: 'Todas' },
  { value: 'baja', label: 'Baja' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

const TIPOS = [
  { value: '', label: 'Todos' },
  { value: 'mantenimiento_preventivo', label: 'Preventivo' },
  { value: 'mantenimiento_correctivo', label: 'Correctivo' },
  { value: 'instalacion', label: 'Instalación' },
  { value: 'inspeccion', label: 'Inspección' },
  { value: 'reparacion', label: 'Reparación' },
  { value: 'emergencia', label: 'Emergencia' },
];

export default function AdvancedFilters({ filters, onChange, onReset, orders, direcciones: propDirecciones }) {
  const { priority, type, assigned_to, jefe_sitio, date_from, date_to, overdue_only } = filters;

  // Consultar TODOS los jefes de sitio desde la entidad Direccion,
  // y fusionar con los que aparecen en las OTs — garantiza que el
  // listado esté completo aunque un jefe no tenga OTs visibles.
  // Si el padre ya pasó direcciones (mismo queryKey), se reutilizan.
  const { data: queriedDirecciones } = useQuery({
    queryKey: ['direcciones-jefes'],
    queryFn: () => base44.entities.Direccion.list('-created_date', 500),
    staleTime: 5 * 60 * 1000,
    enabled: !propDirecciones,
  });
  const direcciones = propDirecciones || queriedDirecciones;

  // Empleados — fuente completa de jefes de sitio y operarios
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-filter'],
    queryFn: () => base44.entities.Employee.list('-updated_date', 500),
    staleTime: 5 * 60 * 1000,
  });

  // Set de nombres de jefes (lowercase) para excluirlos del listado de operarios
  const jefeNamesSet = useMemo(() => {
    const set = new Set();
    const norm = (s) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
    direcciones?.forEach(d => { if (d.jefe_sitio) set.add(norm(d.jefe_sitio)); });
    orders.forEach(o => { if (o.jefe_sitio) set.add(norm(o.jefe_sitio)); });
    return set;
  }, [orders, direcciones]);

  // Operarios asignados — extrae valores únicos de las OTs,
  // excluyendo jefes de sitio (tienen su propio filtro separado)
  const operarios = useMemo(() => {
    const set = new Map();
    const norm = (s) => s.trim().replace(/\s+/g, ' ');
    orders.forEach(o => {
      if (o.assigned_name) {
        const n = norm(o.assigned_name);
        if (!jefeNamesSet.has(n.toLowerCase()) && !set.has(n.toLowerCase())) {
          set.set(n.toLowerCase(), n);
        }
      }
    });
    // Empleados que no son jefes de sitio — aparecen aunque no tengan OTs asignadas
    employees.forEach(e => {
      if (e.full_name && e.role && !e.role.toLowerCase().includes('jefe')) {
        const n = norm(e.full_name);
        if (!jefeNamesSet.has(n.toLowerCase()) && !set.has(n.toLowerCase())) {
          set.set(n.toLowerCase(), n);
        }
      }
    });
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b, 'es'));
  }, [orders, jefeNamesSet, employees]);

  const jefes = useMemo(() => {
    const set = new Map();
    const norm = (s) => s.trim().replace(/\s+/g, ' ');
    // Desde Direccion (fuente canónica de jefes de sitio)
    direcciones?.forEach(d => {
      if (d.jefe_sitio) {
        const n = norm(d.jefe_sitio);
        if (!set.has(n.toLowerCase())) set.set(n.toLowerCase(), n);
      }
    });
    // Desde Empleados con rol jefe de sitio — garantiza que aparezcan aunque no tengan OTs
    employees.forEach(e => {
      if (e.full_name && e.role && e.role.toLowerCase().includes('jefe')) {
        const n = norm(e.full_name);
        if (!set.has(n.toLowerCase())) set.set(n.toLowerCase(), n);
      }
    });
    // Desde las OTs (por si hay jefes que no están en Direccion ni Employees)
    orders.forEach(o => {
      if (o.jefe_sitio) {
        const n = norm(o.jefe_sitio);
        if (!set.has(n.toLowerCase())) set.set(n.toLowerCase(), n);
      }
    });
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b, 'es'));
  }, [orders, direcciones, employees]);

  const activeCount = [priority, type, assigned_to, jefe_sitio, date_from, date_to].filter(Boolean).length + (overdue_only ? 1 : 0);

  const update = (field, value) => onChange({ ...filters, [field]: value });

  return (
    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur border border-slate-700/50 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-white">Filtros Avanzados</h3>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium">
              {activeCount} activo{activeCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onReset} className="text-xs text-slate-400 hover:text-white gap-1">
            <RotateCcw className="h-3 w-3" /> Limpiar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Prioridad */}
        <div>
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Prioridad</label>
          <select
            value={priority}
            onChange={e => update('priority', e.target.value)}
            className="w-full h-9 rounded-md border border-slate-700/50 bg-slate-800/50 text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {/* Tipo */}
        <div>
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Tipo de Trabajo</label>
          <select
            value={type}
            onChange={e => update('type', e.target.value)}
            className="w-full h-9 rounded-md border border-slate-700/50 bg-slate-800/50 text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {/* Operario asignado */}
        <div>
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Operario</label>
          <select
            value={assigned_to}
            onChange={e => update('assigned_to', e.target.value)}
            className="w-full h-9 rounded-md border border-slate-700/50 bg-slate-800/50 text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Todos</option>
            {operarios.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        {/* Jefe de sitio */}
        <div>
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Jefe de Sitio</label>
          <select
            value={jefe_sitio}
            onChange={e => update('jefe_sitio', e.target.value)}
            className="w-full h-9 rounded-md border border-slate-700/50 bg-slate-800/50 text-white text-sm px-3 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Todos</option>
            {jefes.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>

        {/* Fecha desde */}
        <div>
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Fecha desde</label>
          <Input
            type="date"
            value={date_from}
            onChange={e => update('date_from', e.target.value)}
            className="bg-slate-800/50 border-slate-700/50 text-white"
          />
        </div>

        {/* Fecha hasta */}
        <div>
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Fecha hasta</label>
          <Input
            type="date"
            value={date_to}
            onChange={e => update('date_to', e.target.value)}
            className="bg-slate-800/50 border-slate-700/50 text-white"
          />
        </div>
      </div>

      {/* Toggle vencidas */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={overdue_only}
          onChange={e => update('overdue_only', e.target.checked)}
          className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-primary focus:ring-primary"
        />
        <span className="text-sm text-slate-300">Solo vencidas</span>
      </label>
    </div>
  );
}