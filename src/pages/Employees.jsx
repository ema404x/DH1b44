import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, UserCog, Pencil, Trash2, Phone, Mail, QrCode, SettingsIcon } from 'lucide-react';
import QRCodeModal from '@/components/shared/QRCodeModal';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import EntityFormDialog from '@/components/shared/EntityFormDialog';
import AsignacionAutomatica from '@/components/employees/AsignacionAutomatica';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const roleLabels = {
  operario: 'Operario',
  tecnico: 'Técnico',
  capataz: 'Capataz',
  supervisor: 'Supervisor',
  ingeniero: 'Ingeniero',
  administrativo: 'Administrativo',
  gerente: 'Gerente',
  jefe_sitio: 'Jefe de Sitio',
  presupuestista: 'Presupuestista',
  desarrollador: 'Desarrollador',
  compras: 'Compras',
};
const specialtyLabels = {
  electricidad: 'Electricidad', plomeria: 'Plomería', pintura: 'Pintura', albañileria: 'Albañilería',
  carpinteria: 'Carpintería', herreria: 'Herrería', climatizacion: 'Climatización', general: 'General', otro: 'Otro',
};

const employeeFields = [
  { key: 'full_name', label: 'Nombre Completo', required: true },
  { key: 'dni', label: 'DNI' },
  { key: 'role', label: 'Cargo', type: 'select', required: true, options: Object.entries(roleLabels).map(([value, label]) => ({ value, label })) },
  { key: 'specialty', label: 'Especialidad', type: 'select', options: Object.entries(specialtyLabels).map(([value, label]) => ({ value, label })) },
  { key: 'assigned_location', label: 'Ubicación Asignada', type: 'text', description: 'Escuela/Dirección (Se sincroniza automáticamente)' },
  { key: 'assigned_jefe_sitio', label: 'Jefe de Sitio Asignado', type: 'text', description: 'Se sincroniza del módulo de Información General' },
  { key: 'assigned_comuna', label: 'Comuna', type: 'select', options: [
    { value: '8A', label: 'Comuna 8A' },
    { value: '8B', label: 'Comuna 8B' },
    { value: '10A', label: 'Comuna 10A' },
  ]},
  { key: 'status', label: 'Estado', type: 'select', options: [
    { value: 'activo', label: 'Activo' }, { value: 'licencia', label: 'Licencia' },
    { value: 'vacaciones', label: 'Vacaciones' }, { value: 'inactivo', label: 'Inactivo' }
  ]},
  { key: 'phone', label: 'Teléfono' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'hire_date', label: 'Fecha de Ingreso', type: 'date' },
  { key: 'hourly_rate', label: 'Costo/Hora ($)', type: 'number' },
  { key: 'emergency_contact', label: 'Contacto de Emergencia' },
  { key: 'emergency_phone', label: 'Tel. Emergencia' },
  { key: 'notes', label: 'Notas', type: 'textarea' },
];

export default function Employees() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [qrEmployee, setQrEmployee] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading } = useQuery({ queryKey: ['employees'], queryFn: () => base44.entities.Employee.list('-created_date') });
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: () => base44.entities.LocationData.list('-created_date', 500) });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.Employee.update(editing.id, data) : base44.entities.Employee.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employees'] }); setDialogOpen(false); setEditing(null); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Employee.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] })
  });

  // Sincronizar jefes de sitio con Información General
  const syncJefeSitios = async () => {
    setSyncLoading(true);
    try {
      const jefesUnicos = [...new Set(locations.map(l => l.jefe_sitio).filter(Boolean))];
      let syncCount = 0;

      for (const jefeName of jefesUnicos) {
        const existing = employees.find(e => e.full_name?.toLowerCase() === jefeName?.toLowerCase() && e.role === 'jefe_sitio');
        if (!existing) {
          await base44.entities.Employee.create({
            full_name: jefeName,
            role: 'jefe_sitio',
            status: 'activo',
            assigned_jefe_sitio: jefeName,
          });
          syncCount++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['employees'] });
      alert(`✅ Sincronización completada: ${syncCount} jefes de sitio agregados`);
    } catch (error) {
      alert('Error en sincronización: ' + error.message);
    }
    setSyncLoading(false);
  };

  const filtered = employees.filter(e => {
    const matchSearch = !search || e.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || e.role === roleFilter;
    return matchSearch && matchRole;
  });

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <div className="space-y-6">
      <PageHeader title="Empleados" subtitle={`${employees.filter(e => e.status === 'activo').length} activos de ${employees.length} total`} actionLabel="Nuevo Empleado" onAction={() => { setEditing(null); setDialogOpen(true); }} />

      <Collapsible defaultOpen={false} className="space-y-3">
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="gap-2 w-full sm:w-auto">
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

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar empleados..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(roleLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={UserCog} title="No hay empleados" description="Agregá tu primer empleado" actionLabel="Nuevo Empleado" onAction={() => { setEditing(null); setDialogOpen(true); }} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(emp => (
            <Card key={emp.id} className="hover:shadow-md transition-shadow group">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Avatar className="h-11 w-11">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">{getInitials(emp.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold truncate">{emp.full_name}</p>
                        <p className="text-xs text-muted-foreground">{roleLabels[emp.role] || emp.role}</p>
                        {emp.assigned_location && <p className="text-xs text-primary mt-0.5">{emp.assigned_location}</p>}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => setQrEmployee(emp)} title="QR Fichaje">
                          <QrCode className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(emp); setDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>¿Eliminar empleado?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(emp.id)}>Eliminar</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <StatusBadge value={emp.status || 'activo'} />
                    </div>
                    <div className="mt-3 space-y-1">
                      {emp.phone && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3" />{emp.phone}</p>}
                      {emp.email && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="h-3 w-3" />{emp.email}</p>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <QRCodeModal
        open={!!qrEmployee}
        onClose={() => setQrEmployee(null)}
        title={qrEmployee?.full_name || ''}
        subtitle={`Fichaje de asistencia · ${qrEmployee?.role || ''}`}
        value={qrEmployee ? `${window.location.origin}/fichar?id=${qrEmployee.id}` : ''}
      />

      <EntityFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Editar Empleado' : 'Nuevo Empleado'}
        fields={employeeFields}
        initialData={editing || { role: 'operario', specialty: 'general', status: 'activo' }}
        onSave={(data) => saveMutation.mutate(data)}
        saving={saveMutation.isPending}
      />
    </div>
  );
}