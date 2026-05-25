import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import DiagnosticoVinculacion from '@/components/permisos/DiagnosticoVinculacion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Plus, Save, Trash2, Loader2, CheckCircle2, KeyRound, Eye, EyeOff,
  Shield, ChevronDown, ChevronUp, ToggleLeft, ToggleRight
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const MODULES = [
  { key: 'Dashboard', label: 'Dashboard', group: 'General' },
  { key: 'Calendario', label: 'Calendario', group: 'General' },
  { key: 'Alertas', label: 'Alertas Proactivas', group: 'General' },
  { key: 'Project', label: 'Proyectos', group: 'Operaciones' },
  { key: 'WorkOrder', label: 'Órdenes de Trabajo', group: 'Operaciones' },
  { key: 'Pendientes', label: 'Pendientes SAP', group: 'Operaciones' },
  { key: 'Emergencias', label: 'Emergencias', group: 'Operaciones' },
  { key: 'Mapa', label: 'Mapa de Ubicaciones', group: 'Operaciones' },
  { key: 'MapaJefes', label: 'Mapa de Jefes', group: 'Operaciones' },
  { key: 'InspeccionColegio', label: 'Inspección de Colegios', group: 'Operaciones' },
  { key: 'InformePlaneacion', label: 'Informe de Planeación', group: 'Operaciones' },
  { key: 'Informes', label: 'Informes', group: 'Reportes' },
  { key: 'Reportes', label: 'Reportes & KPIs', group: 'Reportes' },
  { key: 'ControlRiesgo', label: 'Control de Riesgos', group: 'Reportes' },
  { key: 'Client', label: 'Proveedores', group: 'Finanzas' },
  { key: 'Quote', label: 'Presupuestos', group: 'Finanzas' },
  { key: 'PresupuestosObra', label: 'Presupuestos Obra', group: 'Finanzas' },
  { key: 'Certificado', label: 'Certificados', group: 'Finanzas' },
  { key: 'AprobacionCertificados', label: 'Aprobación Certificados', group: 'Finanzas' },
  { key: 'CertificacionObras', label: 'Certificación de Obras', group: 'Finanzas' },
  { key: 'Invoice', label: 'Facturación', group: 'Finanzas' },
  { key: 'Finanzas', label: 'Finanzas', group: 'Finanzas' },
  { key: 'Employee', label: 'Empleados', group: 'Administración' },
  { key: 'Inventory', label: 'Inventario', group: 'Administración' },
  { key: 'Asset', label: 'Activos / Pendientes', group: 'Administración' },
  { key: 'InformacionGeneral', label: 'Información General', group: 'Administración' },
  { key: 'Automatizaciones', label: 'Automatizaciones', group: 'Sistema' },
  { key: 'Permisos', label: 'Control de Acceso', group: 'Sistema' },
  { key: 'AuditLog', label: 'Auditoría', group: 'Sistema' },
  { key: 'Seguridad', label: 'Centro de Seguridad', group: 'Sistema' },
  { key: 'ImportarDatos', label: 'Importar Datos', group: 'Sistema' },
  { key: 'Tutorial', label: 'Centro de Aprendizaje', group: 'Sistema' },
];

const GROUPS = ['General', 'Operaciones', 'Reportes', 'Finanzas', 'Administración', 'Sistema'];

const ACTIONS = ['read', 'create', 'update', 'delete', 'export', 'approve'];
const ACTION_LABELS = { read: 'Ver', create: 'Crear', update: 'Editar', delete: 'Eliminar', export: 'Exportar', approve: 'Aprobar' };
const ACTION_COLORS = {
  read: 'text-blue-400', create: 'text-emerald-400', update: 'text-amber-400',
  delete: 'text-red-400', export: 'text-purple-400', approve: 'text-cyan-400'
};

const GROUP_COLORS = {
  General: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Operaciones: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Reportes: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Finanzas: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Administración: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Sistema: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

function ClaveOperarioPanel() {
  const queryClient = useQueryClient();
  const [clave, setClave] = useState('');
  const [showClave, setShowClave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: configs = [] } = useQuery({
    queryKey: ['operario_portal_config'],
    queryFn: () => base44.entities.RolePermission.list(),
    select: (data) => {
      const cfg = data.find(r => r.role_name === 'operario_portal');
      if (cfg) setClave(cfg.description || '');
      return data;
    }
  });

  const existingConfig = configs.find(r => r.role_name === 'operario_portal');

  const handleSave = async () => {
    if (!clave.trim()) return;
    setSaving(true);
    if (existingConfig) {
      await base44.entities.RolePermission.update(existingConfig.id, { description: clave.trim() });
    } else {
      await base44.entities.RolePermission.create({ role_name: 'operario_portal', description: clave.trim(), permissions: {}, is_active: true });
    }
    queryClient.invalidateQueries({ queryKey: ['operario_portal_config'] });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Card className="p-5 border-primary/20 bg-primary/5">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <KeyRound className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">Clave Global del Portal Operarios</h3>
          <p className="text-xs text-muted-foreground">Clave requerida al escanear el QR de un establecimiento.</p>
        </div>
        {!existingConfig && (
          <Badge className="ml-auto bg-amber-500/20 text-amber-400 border-amber-500/30">Sin configurar</Badge>
        )}
      </div>
      <div className="flex gap-2 max-w-sm">
        <div className="relative flex-1">
          <Input
            type={showClave ? 'text' : 'password'}
            value={clave}
            onChange={e => setClave(e.target.value)}
            placeholder="Ingresá la clave..."
            className="pr-10 h-9 text-sm"
          />
          <button onClick={() => setShowClave(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {showClave ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Button onClick={handleSave} disabled={saving || !clave.trim()} size="sm" className="gap-1.5 min-w-[90px]">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <><CheckCircle2 className="h-3.5 w-3.5" /> Listo</> : <><Save className="h-3.5 w-3.5" /> Guardar</>}
        </Button>
      </div>
    </Card>
  );
}

function RoleCard({ role, onDelete, onToggle, deleteIsPending }) {
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RolePermission.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rolePermissions'] })
  });

  const normalizePerms = (perms = {}) => {
    const normalized = { ...perms };
    MODULES.forEach(mod => {
      if (!normalized[mod.key]) {
        normalized[mod.key] = ACTIONS.reduce((acc, act) => ({ ...acc, [act]: false }), {});
      }
    });
    return normalized;
  };

  const handleToggle = (module, action, current) => {
    const newPerms = normalizePerms(role.permissions);
    newPerms[module] = { ...newPerms[module], [action]: !current };
    updateMutation.mutate({ id: role.id, data: { permissions: newPerms } });
  };

  const handleToggleAll = (moduleKey, enable) => {
    const newPerms = normalizePerms(role.permissions);
    newPerms[moduleKey] = ACTIONS.reduce((acc, act) => ({ ...acc, [act]: enable }), {});
    updateMutation.mutate({ id: role.id, data: { permissions: newPerms } });
  };

  const perms = normalizePerms(role.permissions);

  const totalEnabled = MODULES.reduce((sum, mod) => {
    return sum + ACTIONS.filter(act => perms[mod.key]?.[act]).length;
  }, 0);
  const totalPossible = MODULES.length * ACTIONS.length;

  const groupedModules = GROUPS.map(group => ({
    group,
    modules: MODULES.filter(m => m.group === group)
  }));

  return (
    <Card className="overflow-hidden border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-base leading-tight">{role.role_name}</h3>
            {role.description && <p className="text-xs text-muted-foreground">{role.description}</p>}
          </div>
          <Badge variant="outline" className="ml-2 text-xs tabular-nums">
            {totalEnabled}/{totalPossible} permisos
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setCollapsed(v => !v)} className="gap-1.5 text-xs h-8">
            {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            {collapsed ? 'Expandir' : 'Colapsar'}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" disabled={deleteIsPending}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar rol "{role.role_name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminarán todos los permisos configurados para este rol.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(role.id)}>Eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Tabla por grupos */}
      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground w-52">Módulo</th>
                {ACTIONS.map(act => (
                  <th key={act} className={`px-3 py-2.5 text-center font-semibold ${ACTION_COLORS[act]} w-20`}>
                    {ACTION_LABELS[act]}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-center text-muted-foreground w-24">Todo</th>
              </tr>
            </thead>
            <tbody>
              {groupedModules.map(({ group, modules }) => (
                <React.Fragment key={group}>
                  <tr className="bg-muted/20">
                    <td colSpan={ACTIONS.length + 2} className="px-4 py-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${GROUP_COLORS[group]}`}>
                        {group}
                      </span>
                    </td>
                  </tr>
                  {modules.map(mod => {
                    const modPerms = perms[mod.key];
                    const allEnabled = ACTIONS.every(act => modPerms[act]);
                    const anyEnabled = ACTIONS.some(act => modPerms[act]);
                    return (
                      <tr key={mod.key} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2 font-medium text-foreground/80">{mod.label}</td>
                        {ACTIONS.map(act => (
                          <td key={act} className="px-3 py-2 text-center">
                            <Checkbox
                              checked={modPerms[act] || false}
                              onCheckedChange={() => handleToggle(mod.key, act, modPerms[act])}
                              className="mx-auto"
                            />
                          </td>
                        ))}
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => handleToggleAll(mod.key, !allEnabled)}
                            className={`transition-colors ${allEnabled ? 'text-primary' : anyEnabled ? 'text-amber-400' : 'text-muted-foreground/40 hover:text-muted-foreground'}`}
                            title={allEnabled ? 'Desactivar todo' : 'Activar todo'}
                          >
                            {allEnabled
                              ? <ToggleRight className="h-5 w-5" />
                              : <ToggleLeft className="h-5 w-5" />
                            }
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function Permisos() {
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['rolePermissions'],
    queryFn: () => base44.entities.RolePermission.list()
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RolePermission.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rolePermissions'] });
      toast.success('Rol eliminado');
    }
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.RolePermission.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rolePermissions'] });
      setShowNew(false);
      setNewRoleName('');
      toast.success('Rol creado');
    }
  });

  const handleCreateRole = () => {
    if (!newRoleName.trim()) return;
    const permissions = {};
    MODULES.forEach(mod => {
      permissions[mod.key] = ACTIONS.reduce((acc, act) => ({ ...acc, [act]: false }), {});
    });
    createMutation.mutate({
      role_name: newRoleName.trim(),
      permissions,
      description: `Rol personalizado: ${newRoleName.trim()}`
    });
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke('saveAccessConfig', { roles: visibleRoles });
      toast.success(res.data?.message || 'Configuración guardada correctamente');
    } catch (err) {
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const visibleRoles = roles.filter(r => r.role_name !== 'operario_portal');

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
      <Loader2 className="h-5 w-5 animate-spin" /> Cargando permisos...
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Control de Acceso</h1>
            <p className="text-sm text-muted-foreground">Configurá los permisos de cada rol en el sistema</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleSaveAll} disabled={saving || roles.length === 0} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Sincronizar
          </Button>
          <Button size="sm" onClick={() => setShowNew(!showNew)} className="gap-2">
            <Plus className="h-4 w-4" /> Nuevo Rol
          </Button>
        </div>
      </div>

      {/* Nuevo rol */}
      {showNew && (
        <Card className="p-4 border-primary/20">
          <p className="text-sm font-medium mb-3">Nombre del nuevo rol</p>
          <div className="flex gap-2 max-w-sm">
            <Input
              placeholder="ej: supervisor_campo"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateRole()}
              className="h-9 text-sm"
            />
            <Button size="sm" onClick={handleCreateRole} disabled={createMutation.isPending || !newRoleName.trim()} className="min-w-[80px]">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowNew(false); setNewRoleName(''); }}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      <ClaveOperarioPanel />
      <DiagnosticoVinculacion />

      {/* Roles */}
      <div className="space-y-4">
        {visibleRoles.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
            No hay roles configurados. Creá uno con el botón "Nuevo Rol".
          </div>
        )}
        {visibleRoles.map(role => (
          <RoleCard
            key={role.id}
            role={role}
            onDelete={(id) => deleteMutation.mutate(id)}
            deleteIsPending={deleteMutation.isPending}
          />
        ))}
      </div>
    </div>
  );
}