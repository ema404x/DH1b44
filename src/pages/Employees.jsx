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
import { Search, UserCog, Pencil, Trash2, Phone, Mail, QrCode, SettingsIcon, Plus, Users, Zap } from 'lucide-react';
import QRCodeModal from '@/components/shared/QRCodeModal';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import EntityFormDialog from '@/components/shared/EntityFormDialog';
import AsignacionAutomatica from '@/components/employees/AsignacionAutomatica';
import InviteUserDialog from '@/components/employees/InviteUserDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const roleLabels = {
  operario: 'Operario', tecnico: 'Técnico', capataz: 'Capataz', supervisor: 'Supervisor',
  ingeniero: 'Ingeniero', administrativo: 'Administrativo', gerente: 'Gerente', jefe_sitio: 'Jefe de Sitio',
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
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [qrEmployee, setQrEmployee] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading } = useQuery({ queryKey: ['employees'], queryFn: () => base44.entities.Employee.list('-created_date') });
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: () => base44.entities.LocationData.list('-created_date', 500) });
  const { data: rolePermissions = [] } = useQuery({ queryKey: ['rolePermissions'], queryFn: () => base44.entities.RolePermission.list() });

  const computedEmployeeFields = useMemo(() => {
    const roleOptions = rolePermissions.length > 0
      ? rolePermissions.map(r => ({ value: r.role_name, label: r.role_name }))
      : Object.entries(roleLabels).map(([value, label]) => ({ value, label }));
    return employeeFields.map(f => f.key === 'role' ? { ...f, options: roleOptions } : f);
  }, [rolePermissions]);

  const stats = useMemo(() => ({
    total: employees.length,
    activos: employees.filter(e => e.status === 'activo').length,
  }), [employees]);

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.Employee.update(editing.id, data) : base44.entities.Employee.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employees'] }); setDialogOpen(false); setEditing(null); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Employee.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] })
  });

  const filtered = employees.filter(e => {
    const matchSearch = !search || e.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || e.role === roleFilter;
    return matchSearch && matchRole;
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
            <Button variant="outline" onClick={() => setInviteOpen(true)} className="gap-2 border-slate-700/50 bg-slate-800/50 text-white hover:bg-slate-700/50">
              <Mail className="h-4 w-4" /> Invitar
            </Button>
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-lg shadow-cyan-500/50 transition-all">
              <Plus className="h-4 w-4" /> Nuevo Empleado
            </Button>
          </div>
        </div>

        {/* Stats */}
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: stats.total, icon: Users, color: 'from-blue-500' },
            { label: 'Activos', value: stats.activos, icon: Zap, color: 'from-emerald-500' },
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
              ? rolePermissions.map(r => ({ value: r.role_name, label: r.role_name }))
              : Object.entries(roleLabels).map(([value, label]) => ({ value, label }))
            ).map(({ value, label }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Grid */}
      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={UserCog} title="No hay empleados" description="Agregá tu primer empleado" actionLabel="Nuevo Empleado" onAction={() => { setEditing(null); setDialogOpen(true); }} />
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(emp => (
            <motion.div key={emp.id} variants={item}>
              <Card className="group border-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur hover:shadow-xl hover:shadow-cyan-500/20 transition-all border border-slate-700/50">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12 flex-shrink-0">
                      <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-semibold">{getInitials(emp.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-white">{emp.full_name}</p>
                          <Badge variant="secondary" className="mt-1 text-xs">{emp.role}</Badge>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-cyan-400 hover:text-cyan-300" onClick={() => setQrEmployee(emp)}>
                            <QrCode className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400" onClick={() => { setEditing(emp); setDialogOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500"><Trash2 className="h-3.5 w-3.5" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar empleado?</AlertDialogTitle>
                                <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(emp.id)}>Eliminar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>

                      <StatusBadge value={emp.status || 'activo'} />

                      {emp.assigned_location && <p className="text-xs text-cyan-400 mt-2">📍 {emp.assigned_location}</p>}

                      <div className="mt-3 space-y-1">
                        {emp.phone && <p className="text-xs text-slate-400 flex items-center gap-1.5"><Phone className="h-3 w-3" />{emp.phone}</p>}
                        {emp.email && <p className="text-xs text-slate-400 flex items-center gap-1.5"><Mail className="h-3 w-3" />{emp.email}</p>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
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