import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, UserCog, Mail, SettingsIcon, Plus, Users, Zap, Building2, AlertTriangle } from 'lucide-react';
import QRCodeModal from '@/components/shared/QRCodeModal';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import EntityFormDialog from '@/components/shared/EntityFormDialog';
import AsignacionAutomatica from '@/components/employees/AsignacionAutomatica';
import InviteUserDialog from '@/components/employees/InviteUserDialog';
import SyncEmployeesButton from '@/components/employees/SyncEmployeesButton';
import EmployeeCard from '@/components/employees/EmployeeCard';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getActiveSectorId, withActiveSector } from '@/lib/sectorContext';

const roleLabels = {
  operario: 'Operario', tecnico: 'Técnico', capataz: 'Capataz', supervisor: 'Supervisor',
  ingeniero: 'Ingeniero', administrativo: 'Administrativo', gerente: 'Gerente', jefe_sitio: 'Jefe de Sitio',
  inspector: 'Inspector', admin: 'Administrador', viewer: 'Visualizador',
};

const roleBadgeColors = {
  jefe_sitio: 'bg-violet-500/20 text-violet-300 border border-violet-500/30',
  inspector:  'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
  supervisor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  gerente:    'bg-rose-500/20 text-rose-300 border border-rose-500/30',
  admin:      'bg-rose-500/20 text-rose-300 border border-rose-500/30',
  tecnico:    'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  operario:   'bg-slate-500/20 text-slate-300 border border-slate-500/30',
};

const comunaColors = {
  '8A':  'bg-emerald-500/20 text-emerald-300',
  '8B':  'bg-sky-500/20 text-sky-300',
  '10A': 'bg-orange-500/20 text-orange-300',
};

const employeeFields = [
  { key: 'full_name', label: 'Nombre Completo', required: true },
  { key: 'dni', label: 'DNI' },
  { key: 'role', label: 'Cargo', type: 'select', required: true, options: [] }, // se sobreescribe dinámicamente abajo
  { key: 'assigned_location', label: 'Ubicación Asignada' },
  { key: 'assigned_jefe_sitio', label: 'Jefe de Sitio' },
  { key: 'assigned_comuna', label: 'Comuna', type: 'select', options: [
    { value: '8A', label: 'Comuna 8A' }, { value: '8B', label: 'Comuna 8B' }, { value: '10A', label: 'Comuna 10A' },
  ]},
  { key: 'status', label: 'Estado', type: 'select', options: [
    { value: 'activo', label: 'Activo' }, { value: 'licencia', label: 'Licencia' },
    { value: 'vacaciones', label: 'Vacaciones' }, { value: 'inactivo', label: 'Inactivo' }
  ]},
  { key: 'phone', label: 'Teléfono' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'hire_date', label: 'Fecha de Ingreso', type: 'date' },
  { key: 'hourly_rate', label: 'Costo/Hora ($)', type: 'number' },
  { key: 'notes', label: 'Notas', type: 'textarea' },
];

export default function Employees() {
  const { allowed: canEdit } = usePermission('Employee', 'update');
  const { allowed: canCreate } = usePermission('Employee', 'create');
  const { allowed: canDelete } = usePermission('Employee', 'delete');
  const { currentUser } = useCurrentUser();
  // Sector activo resuelto de forma central (fail-closed, sin default 'escuela').
  const activeSectorId = getActiveSectorId(currentUser);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [qrEmployee, setQrEmployee] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees', activeSectorId],
    // Scope explícito por sector además de la RLS. La RLS tiene una rama self
    // (data.user_id) que no valida sector y deja ver la propia ficha de otro
    // sector al switchearte. Este filtro cierra esa fuga en la grilla.
    queryFn: () => activeSectorId
      ? base44.entities.Employee.filter({ sector_id: activeSectorId }, '-created_date')
      : base44.entities.Employee.list('-created_date'),
  });
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: () => base44.entities.LocationData.list('-created_date', 500) });
  const { data: rolePermissions = [] } = useQuery({ queryKey: ['rolePermissions'], queryFn: () => base44.entities.RolePermission.list() });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => base44.entities.User.list('-created_date', 500) });

  const jefesSitio = useMemo(() =>
    employees.filter(e => e.role === 'jefe_sitio').map(e => ({ value: e.full_name, label: e.full_name })),
    [employees]
  );

  const computedEmployeeFields = useMemo(() => {
    const roleOptions = rolePermissions.length > 0
      ? rolePermissions.map(r => ({ value: r.role_name, label: r.role_name }))
      : Object.entries(roleLabels).map(([value, label]) => ({ value, label }));
    return employeeFields.map(f => {
      if (f.key === 'role') return { ...f, options: roleOptions };
      if (f.key === 'assigned_jefe_sitio') return { ...f, type: 'select', options: jefesSitio };
      return f;
    });
  }, [rolePermissions, jefesSitio]);

  // Resuelve el label legible del rol
  const getRoleLabel = (roleKey) => {
    if (!roleKey) return '—';
    const fromPermissions = rolePermissions.find(r => r.role_name === roleKey);
    if (fromPermissions?.description) return fromPermissions.description;
    return roleLabels[roleKey] || roleKey;
  };

  const getRoleBadgeClass = (roleKey) =>
    roleBadgeColors[roleKey] || 'bg-slate-500/20 text-slate-300 border border-slate-500/30';

  const stats = useMemo(() => ({
    total: employees.length,
    activos: employees.filter(e => e.status === 'activo').length,
    jefesSitio: employees.filter(e => e.role === 'jefe_sitio').length,
    inspectores: employees.filter(e => e.role === 'inspector').length,
  }), [employees]);

  // ── Diagnóstico de vinculación por empleado ──
  // Determina si el empleado puede ingresar al sistema o tiene algún problema.
  const getLinkStatus = (emp) => {
    if (!emp.email?.trim()) {
      return { level: 'error', label: 'Sin email', detail: 'No tiene email configurado, no puede ingresar' };
    }
    const platformUser = emp.user_id ? users.find(u => u.id === emp.user_id) : null;
    if (!emp.user_id) {
      return { level: 'error', label: 'Sin vincular', detail: 'Tiene email pero no está vinculado a un usuario' };
    }
    if (!platformUser) {
      return { level: 'error', label: 'Usuario roto', detail: 'El user_id no corresponde a un usuario activo' };
    }
    if (platformUser.email?.toLowerCase().trim() !== emp.email?.toLowerCase().trim()) {
      return { level: 'error', label: 'Email no coincide', detail: 'El email del usuario no coincide con la ficha' };
    }
    if (emp.role && rolePermissions.length > 0) {
      const roleNorm = emp.role.toLowerCase().trim();
      const hasRolePerm = rolePermissions.some(rp => rp.role_name?.toLowerCase().trim() === roleNorm);
      if (!hasRolePerm) {
        return { level: 'error', label: 'Sin permisos', detail: `El rol "${emp.role}" no tiene permisos configurados` };
      }
    }
    return { level: 'ok', label: 'Vinculado', detail: 'Puede ingresar al sistema' };
  };

  const employeesWithIssues = useMemo(() =>
    employees.filter(e => getLinkStatus(e).level === 'error'),
    [employees, users, rolePermissions]
  );

  // Re-vincular: busca el usuario de plataforma cuyo email coincide con el empleado
  // y lo vincula directamente. Si no hay match, limpia el user_id stale.
  const relinkMutation = useMutation({
    mutationFn: async (emp) => {
      if (!emp.email) return { matched: false };
      const matchingUser = users.find(
        u => u.email?.toLowerCase().trim() === emp.email?.toLowerCase().trim()
      );
      if (matchingUser) {
        await base44.entities.Employee.update(emp.id, { user_id: matchingUser.id });
        return { matched: true };
      }
      // No hay usuario de plataforma con ese email → limpiar user_id stale
      if (emp.user_id) {
        await base44.entities.Employee.update(emp.id, { user_id: null });
      }
      return { matched: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (result?.matched) {
        toast({ title: 'Empleado vinculado', description: 'El usuario se vinculó correctamente.' });
      } else {
        toast({ title: 'Sin usuario coincidente', description: 'No hay usuario de plataforma con ese email. Invitalo primero.', variant: 'destructive' });
      }
    },
    onError: (err) => {
      toast({ title: 'Error al re-vincular', description: err?.message || 'No se pudo completar la operación.', variant: 'destructive' });
    }
  });

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (editing) return base44.entities.Employee.update(editing.id, data);
      // Estampa el sector activo de forma central (fail-closed). Si no se resuelve,
      // no se inventa 'escuela' — el backend stampSectorOnCreate lo marca SIN_SECTOR.
      return base44.entities.Employee.create(withActiveSector(data, currentUser));
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employees'] }); setDialogOpen(false); setEditing(null); },
    onError: (err) => {
      toast({ title: 'Error al guardar', description: err?.message || 'No se pudo guardar el empleado.', variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Employee.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] })
  });

  const filtered = employees.filter(e => {
    const matchSearch = !search || e.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || e.role === roleFilter;
    const matchIssue = !onlyIssues || getLinkStatus(e).level === 'error';
    return matchSearch && matchRole && matchIssue;
  });

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 space-y-6">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-cyan-500/30 rounded-full blur-3xl opacity-20 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
              </div>
              Empleados
            </h1>
            <p className="text-slate-400 mt-1">{stats.activos} activos de {stats.total} total</p>
          </div>
          <div className="flex gap-2">
            {canCreate && (
              <Button variant="outline" onClick={() => setInviteOpen(true)} className="gap-2 border-slate-700/50 bg-slate-800/50 text-white hover:bg-slate-700/50">
                <Mail className="h-4 w-4" /> Invitar
              </Button>
            )}
            {canCreate && (
              <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-lg shadow-cyan-500/50 transition-all">
                <Plus className="h-4 w-4" /> Nuevo Empleado
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: stats.total, icon: Users, color: 'from-blue-500' },
            { label: 'Activos', value: stats.activos, icon: Zap, color: 'from-emerald-500' },
            { label: 'Jefes de Sitio', value: stats.jefesSitio, icon: Building2, color: 'from-violet-500' },
            { label: 'Con Problemas', value: employeesWithIssues.length, icon: AlertTriangle, color: 'from-red-500' },
          ].map((stat, i) => (
            <motion.div key={i} variants={item}>
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur border border-slate-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-400 uppercase">{stat.label}</p>
                  <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${stat.color} to-transparent flex items-center justify-center`}>
                    <stat.icon className="h-4 w-4 text-white" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Sincronización */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <Collapsible defaultOpen={false} className="space-y-3">
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="gap-2 w-full sm:w-auto border-slate-700/50 bg-slate-800/50 text-white hover:bg-slate-700/50">
              <SettingsIcon className="h-4 w-4" />
              Herramientas de Sincronización
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4">
            <SyncEmployeesButton onSyncComplete={() => queryClient.invalidateQueries({ queryKey: ['employees'] })} />
            <AsignacionAutomatica
              employees={employees}
              locations={locations}
              onSyncComplete={() => queryClient.invalidateQueries({ queryKey: ['employees'] })}
            />
          </CollapsibleContent>
        </Collapsible>
      </motion.div>

      {/* Filtros */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Buscar empleados..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-40 bg-slate-800/50 border-slate-700/50 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los cargos</SelectItem>
            {(rolePermissions.length > 0
              ? rolePermissions.map(r => ({ value: r.role_name, label: r.description || roleLabels[r.role_name] || r.role_name }))
              : Object.entries(roleLabels).map(([value, label]) => ({ value, label }))
            ).map(({ value, label }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {employeesWithIssues.length > 0 && (
          <Button
            variant={onlyIssues ? 'default' : 'outline'}
            onClick={() => setOnlyIssues(!onlyIssues)}
            className={`gap-2 border-slate-700/50 ${onlyIssues ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-slate-800/50 text-white hover:bg-slate-700/50'}`}
          >
            <AlertTriangle className="h-4 w-4" />
            {onlyIssues ? 'Ver todos' : `${employeesWithIssues.length} con problemas`}
          </Button>
        )}
      </motion.div>

      {/* Grid */}
      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={UserCog} title="No hay empleados" description="Agregá tu primer empleado" actionLabel="Nuevo Empleado" onAction={() => { setEditing(null); setDialogOpen(true); }} />
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(emp => (
            <EmployeeCard
              key={emp.id}
              emp={emp}
              canEdit={canEdit}
              canDelete={canDelete}
              roleLabel={getRoleLabel(emp.role)}
              roleBadgeClass={getRoleBadgeClass(emp.role)}
              item={item}
              onEdit={(emp) => { setEditing(emp); setDialogOpen(true); }}
              onDelete={(id) => deleteMutation.mutate(id)}
              onQR={setQrEmployee}
              onRelink={(emp) => relinkMutation.mutate(emp)}
              isRelinking={relinkMutation.isPending}
              users={users}
              rolePermissions={rolePermissions}
            />
          ))}
        </motion.div>
      )}

      <QRCodeModal
        open={!!qrEmployee}
        onClose={() => setQrEmployee(null)}
        title={qrEmployee?.full_name || ''}
        subtitle={`Fichaje · ${qrEmployee?.role || ''}`}
        value={qrEmployee ? `${window.location.origin}/fichar?id=${qrEmployee.id}` : ''}
      />

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />

      <EntityFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Editar Empleado' : 'Nuevo Empleado'}
        fields={computedEmployeeFields}
        initialData={editing || { role: computedEmployeeFields.find(f => f.key === 'role')?.options?.[0]?.value || '', status: 'activo' }}
        onSave={(data) => saveMutation.mutate(data)}
        saving={saveMutation.isPending}
      />
    </div>
  );
}