import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Plus, Save, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const MODULES = [
  'WorkOrder', 'Certificado', 'Project', 'Client', 'Employee', 
  'Asset', 'Inventory', 'Invoice', 'Quote', 'AuditLog'
];

const ACTIONS = ['read', 'create', 'update', 'delete', 'export', 'approve'];

export default function Permisos() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke('saveAccessConfig', { roles });
      toast.success(res.data?.message || 'Configuración guardada correctamente');
    } catch (err) {
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['rolePermissions'],
    queryFn: () => base44.entities.RolePermission.list()
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RolePermission.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rolePermissions'] })
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RolePermission.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rolePermissions'] })
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.RolePermission.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rolePermissions'] });
      setShowNew(false);
      setNewRoleName('');
    }
  });

  const handlePermissionToggle = (roleId, module, action, current) => {
    const role = roles.find(r => r.id === roleId);
    const newPerms = { ...role.permissions };
    newPerms[module] = { ...newPerms[module], [action]: !current };
    updateMutation.mutate({ id: roleId, data: { permissions: newPerms } });
  };

  const handleCreateRole = () => {
    if (!newRoleName.trim()) return;
    const permissions = {};
    MODULES.forEach(mod => {
      permissions[mod] = ACTIONS.reduce((acc, act) => ({ ...acc, [act]: false }), {});
    });
    createMutation.mutate({ role_name: newRoleName, permissions, description: `Rol personalizado: ${newRoleName}` });
  };

  if (isLoading) return <div className="text-center py-12">Cargando...</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Control de Acceso</h1>
          <p className="text-muted-foreground mt-1">Configura permisos por rol</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSaveAll} disabled={saving || roles.length === 0} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar configuración
          </Button>
          <Button onClick={() => setShowNew(!showNew)} className="gap-2"><Plus className="h-4 w-4" />Nuevo Rol</Button>
        </div>
      </div>

      {showNew && (
        <Card className="p-4">
          <div className="flex gap-2">
            <Input placeholder="Nombre del rol..." value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} />
            <Button onClick={handleCreateRole} disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear'}
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {roles.map((role) => (
          <Card key={role.id} className="p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold">{role.role_name}</h2>
                <p className="text-sm text-muted-foreground">{role.description}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(role.id)} 
                className="text-destructive hover:text-destructive" disabled={deleteMutation.isPending}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left font-semibold">Módulo</th>
                    {ACTIONS.map(act => (
                      <th key={act} className="px-4 py-2 text-center font-semibold capitalize">{act}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map(mod => (
                    <tr key={mod} className="border-b hover:bg-muted/40">
                      <td className="px-4 py-2 font-medium">{mod}</td>
                      {ACTIONS.map(act => (
                        <td key={act} className="px-4 py-2 text-center">
                          <Checkbox
                            checked={role.permissions[mod]?.[act] || false}
                            onCheckedChange={() => handlePermissionToggle(role.id, mod, act, role.permissions[mod]?.[act])}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}