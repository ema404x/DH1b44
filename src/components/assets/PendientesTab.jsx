import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, ClipboardList, Upload } from 'lucide-react';
import { isPast } from 'date-fns';
import { toast } from 'sonner';
import PendienteDialog from '@/components/assets/PendienteDialog';
import PendienteCard from '@/components/assets/PendienteCard';
import PendientesImportModal from '@/components/assets/PendientesImportModal';

const estadoColors = {
  pendiente: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  asignado: 'bg-blue-100 text-blue-700 border-blue-200',
  en_progreso: 'bg-purple-100 text-purple-700 border-purple-200',
  resuelto: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelado: 'bg-gray-100 text-gray-500 border-gray-200',
};

const prioridadColors = {
  baja: 'bg-slate-100 text-slate-600',
  media: 'bg-blue-100 text-blue-700',
  alta: 'bg-orange-100 text-orange-700',
  urgente: 'bg-red-100 text-red-700',
};

export default function PendientesTab() {
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('all');
  const [filterTipo, setFilterTipo] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const qc = useQueryClient();

  const { data: pendientes = [], isLoading } = useQuery({
    queryKey: ['pendientes'],
    queryFn: () => base44.entities.Pendiente.list('-created_date'),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => selected
      ? base44.entities.Pendiente.update(selected.id, data)
      : base44.entities.Pendiente.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pendientes'] });
      setDialogOpen(false);
      setSelected(null);
      toast.success(selected ? 'Pendiente actualizado' : 'Pendiente creado');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Pendiente.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pendientes'] });
      toast.success('Pendiente eliminado');
    },
  });

  const openNew = () => { setSelected(null); setDialogOpen(true); };
  const openEdit = (p) => { setSelected(p); setDialogOpen(true); };

  const filtered = pendientes.filter(p => {
    const matchSearch = !search ||
      p.descripcion?.toLowerCase().includes(search.toLowerCase()) ||
      p.numero_sap?.toLowerCase().includes(search.toLowerCase()) ||
      p.sitio?.toLowerCase().includes(search.toLowerCase()) ||
      p.jefe_sitio?.toLowerCase().includes(search.toLowerCase());
    const matchEstado = filterEstado === 'all' || p.estado === filterEstado;
    const matchTipo = filterTipo === 'all' || p.tipo === filterTipo;
    return matchSearch && matchEstado && matchTipo;
  });

  const stats = {
    total: pendientes.length,
    pendiente: pendientes.filter(p => p.estado === 'pendiente').length,
    asignado: pendientes.filter(p => p.estado === 'asignado' || p.estado === 'en_progreso').length,
    resuelto: pendientes.filter(p => p.estado === 'resuelto').length,
    vencidos: pendientes.filter(p => p.fecha_limite && isPast(new Date(p.fecha_limite)) && p.estado !== 'resuelto' && p.estado !== 'cancelado').length,
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'border-l-slate-400' },
          { label: 'Sin asignar', value: stats.pendiente, color: 'border-l-yellow-400' },
          { label: 'En curso', value: stats.asignado, color: 'border-l-blue-500' },
          { label: 'Resueltos', value: stats.resuelto, color: 'border-l-emerald-500' },
          { label: 'Vencidos', value: stats.vencidos, color: 'border-l-red-500' },
        ].map(s => (
          <Card key={s.label} className={`border-l-4 ${s.color}`}>
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por SAP, descripción, sitio, jefe..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="asignado">Asignado</SelectItem>
            <SelectItem value="en_progreso">En progreso</SelectItem>
            <SelectItem value="resuelto">Resuelto</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
            <SelectItem value="obra">Obra</SelectItem>
            <SelectItem value="inspeccion">Inspección</SelectItem>
            <SelectItem value="emergencia">Emergencia</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-1.5 whitespace-nowrap" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" /> Importar SAP
          </Button>
          <Button onClick={openNew} className="gap-1.5 whitespace-nowrap">
            <Plus className="h-4 w-4" /> Nuevo
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(p => (
          <PendienteCard
            key={p.id}
            pendiente={p}
            estadoColors={estadoColors}
            prioridadColors={prioridadColors}
            onEdit={openEdit}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        ))}
        {filtered.length === 0 && !isLoading && (
          <div className="col-span-full text-center py-16 text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No hay pendientes</p>
            <p className="text-sm mt-1">Importá desde SAP o creá uno manualmente</p>
          </div>
        )}
      </div>

      <PendienteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pendiente={selected}
        onSave={(data) => saveMutation.mutate(data)}
        isSaving={saveMutation.isPending}
      />

      <PendientesImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => {
          qc.invalidateQueries({ queryKey: ['pendientes'] });
          toast.success('Pendientes importados correctamente');
        }}
      />
    </div>
  );
}