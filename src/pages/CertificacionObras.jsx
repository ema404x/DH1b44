import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Plus, Search, FileCheck, DollarSign, Clock, TrendingUp, CheckCircle2,
  AlertCircle, Filter, ChevronDown, Building2, User, Calendar, Hash, FileSpreadsheet
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ObraCertificacionDialog from '@/components/certificacion/ObraCertificacionDialog';
import ObraCertificacionCard from '@/components/certificacion/ObraCertificacionCard';
import ImportarObrasExcel from '@/components/certificacion/ImportarObrasExcel';

const ESTADO_CONFIG = {
  pendiente:   { label: 'Pendiente',   color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  en_gestion:  { label: 'En Gestión',  color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  cobrado:     { label: 'Cobrado',     color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  rechazado:   { label: 'Rechazado',   color: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

const PRIORIDAD_CONFIG = {
  normal:  { label: 'Normal',  color: 'bg-slate-500/15 text-slate-400' },
  alta:    { label: 'Alta',    color: 'bg-orange-500/15 text-orange-400' },
  urgente: { label: 'Urgente', color: 'bg-red-500/15 text-red-400' },
};

export default function CertificacionObras() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data: obras = [], isLoading } = useQuery({
    queryKey: ['obras-certificacion'],
    queryFn: () => base44.entities.ObraCertificacion.list('-created_date'),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => data.id
      ? base44.entities.ObraCertificacion.update(data.id, data)
      : base44.entities.ObraCertificacion.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obras-certificacion'] });
      setDialogOpen(false);
      setSelected(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ObraCertificacion.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obras-certificacion'] }),
  });

  const handleNew = () => { setSelected(null); setDialogOpen(true); };
  const handleEdit = (obra) => { setSelected(obra); setDialogOpen(true); };

  const filtered = obras.filter(o => {
    const matchSearch = !search ||
      o.titulo?.toLowerCase().includes(search.toLowerCase()) ||
      o.contratista?.toLowerCase().includes(search.toLowerCase()) ||
      o.establecimiento?.toLowerCase().includes(search.toLowerCase()) ||
      o.codigo?.toLowerCase().includes(search.toLowerCase());
    const matchEstado = filtroEstado === 'todos' || o.estado_cobro === filtroEstado;
    return matchSearch && matchEstado;
  });

  // KPIs
  const totalMonto = obras.filter(o => o.estado_cobro !== 'cobrado').reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);
  const pendientes = obras.filter(o => o.estado_cobro === 'pendiente').length;
  const enGestion  = obras.filter(o => o.estado_cobro === 'en_gestion').length;
  const cobrados   = obras.filter(o => o.estado_cobro === 'cobrado').length;
  const urgentes   = obras.filter(o => o.prioridad === 'urgente' && o.estado_cobro !== 'cobrado').length;

  const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileCheck className="h-6 w-6 text-primary" />
            Certificación de Obras
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Listado de obras pendientes de cobro y en gestión</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Importar Excel
          </Button>
          <Button onClick={handleNew} className="gap-2">
            <Plus className="h-4 w-4" /> Nueva Obra
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-muted-foreground">Pendientes</span>
            </div>
            <p className="text-2xl font-bold text-amber-400">{pendientes}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-muted-foreground">En Gestión</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">{enGestion}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-muted-foreground">Cobrados</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">{cobrados}</p>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total a Cobrar</span>
            </div>
            <p className="text-lg font-bold text-primary leading-tight">{fmt(totalMonto)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por obra, contratista, establecimiento..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="en_gestion">En Gestión</SelectItem>
            <SelectItem value="cobrado">Cobrado</SelectItem>
            <SelectItem value="rechazado">Rechazado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alerta urgentes */}
      {urgentes > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/5">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">
            Hay <strong>{urgentes}</strong> obra{urgentes > 1 ? 's' : ''} con prioridad urgente pendiente{urgentes > 1 ? 's' : ''} de cobro.
          </p>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileCheck className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No hay obras registradas{search || filtroEstado !== 'todos' ? ' con esos filtros' : ''}.</p>
          {!search && filtroEstado === 'todos' && (
            <Button variant="outline" size="sm" className="mt-4" onClick={handleNew}>
              <Plus className="h-4 w-4 mr-2" /> Agregar primera obra
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(obra => (
            <ObraCertificacionCard
              key={obra.id}
              obra={obra}
              estadoConfig={ESTADO_CONFIG}
              prioridadConfig={PRIORIDAD_CONFIG}
              onEdit={handleEdit}
              onDelete={() => deleteMutation.mutate(obra.id)}
              onEstadoChange={(id, estado) => saveMutation.mutate({ id, estado_cobro: estado })}
              fmt={fmt}
            />
          ))}
        </div>
      )}

      <ImportarObrasExcel
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          qc.invalidateQueries({ queryKey: ['obras-certificacion'] });
          setImportOpen(false);
        }}
      />

      <ObraCertificacionDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setSelected(null); }}
        obra={selected}
        onSave={(data) => saveMutation.mutate(data)}
        saving={saveMutation.isPending}
        estadoConfig={ESTADO_CONFIG}
        prioridadConfig={PRIORIDAD_CONFIG}
      />
    </div>
  );
}