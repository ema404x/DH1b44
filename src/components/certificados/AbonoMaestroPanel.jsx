import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Plus, Loader2, DollarSign, RefreshCw, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { parseMonto, fmt, calcularFechas, EMPTY_FORM } from './abonoUtils';
import AbonoMaestroCard from './AbonoMaestroCard';
import AbonoMaestroForm from './AbonoMaestroForm';

export default function AbonoMaestroPanel() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data: abonos = [], isLoading } = useQuery({
    queryKey: ['abonos-maestro'],
    queryFn: () => base44.entities.AbonoMaestro.list('-created_date'),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return abonos;
    const q = search.toLowerCase();
    return abonos.filter(a =>
      a.contratista?.toLowerCase().includes(q) ||
      a.ada_numero?.toLowerCase().includes(q) ||
      a.oc_numero?.toLowerCase().includes(q) ||
      a.obra_servicio?.toLowerCase().includes(q) ||
      a.emprendimiento?.toLowerCase().includes(q)
    );
  }, [abonos, search]);

  const stats = useMemo(() => {
    const activos = abonos.filter(a => a.estado === 'activo').length;
    const lotesPendientes = abonos.filter(a => !a.lote_generado && a.estado === 'activo').length;
    const totalMensual = abonos.filter(a => a.estado === 'activo').reduce((acc, a) => acc + parseMonto(a.monto_mensual), 0);
    return { activos, lotesPendientes, totalMensual };
  }, [abonos]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const monto = parseMonto(data.monto_total_contrato);
      const meses = parseInt(data.duracion_meses) || 1;
      const { fechaInicio, fechaFin } = calcularFechas(data.fecha_oc_emision, meses);
      const itemsConTotal = (data.items || []).map(it => ({
        ...it,
        importe_unitario: parseMonto(it.importe_unitario),
        importe_total: parseMonto(it.importe_total) || (parseMonto(it.cantidad) * parseMonto(it.importe_unitario)),
      }));
      const payload = {
        ...data,
        monto_total_contrato: monto,
        duracion_meses: meses,
        monto_mensual: meses > 0 ? monto / meses : 0,
        fecha_inicio_validez: fechaInicio,
        fecha_fin_validez: fechaFin,
        items: itemsConTotal,
        ...(editingId ? {} : { certificados_emitidos: 0, lote_generado: false }),
      };
      if (editingId) return base44.entities.AbonoMaestro.update(editingId, payload);
      return base44.entities.AbonoMaestro.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['abonos-maestro'] });
      toast.success(editingId ? 'Abono actualizado' : 'Abono creado correctamente');
      setShowForm(false); setEditingId(null); setForm(EMPTY_FORM);
    },
    onError: (e) => toast.error('Error: ' + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AbonoMaestro.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['abonos-maestro'] }); toast.success('Abono eliminado'); },
  });

  const handleEdit = (abono) => {
    setEditingId(abono.id);
    setForm({
      contratista: abono.contratista || '',
      oc_numero: abono.oc_numero || '',
      ada_numero: abono.ada_numero || '',
      obra_servicio: abono.obra_servicio || '',
      emprendimiento: abono.emprendimiento || '',
      monto_total_contrato: abono.monto_total_contrato ? String(abono.monto_total_contrato) : '',
      fecha_oc_emision: abono.fecha_oc_emision || '',
      duracion_meses: abono.duracion_meses || '',
      plazo_obra: abono.plazo_obra || '',
      condiciones_pago: abono.condiciones_pago || '',
      anticipo_pct: abono.anticipo_pct ?? 0,
      fondo_reparo_pct: abono.fondo_reparo_pct ?? 0,
      items: abono.items?.length
        ? abono.items.map(it => ({ ...it, importe_unitario: parseMonto(it.importe_unitario), importe_total: parseMonto(it.importe_total) }))
        : [{ descripcion: '', um: 'MES', cantidad: 1, importe_unitario: '', importe_total: 0 }],
      estado: abono.estado || 'activo',
      notas: abono.notas || '',
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      {/* Header con stats + búsqueda */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex gap-3 flex-wrap">
          <div className="text-center bg-muted/40 rounded-lg px-4 py-2">
            <p className="text-[10px] text-muted-foreground">Activos</p>
            <p className="text-lg font-bold text-emerald-400">{stats.activos}</p>
          </div>
          <div className="text-center bg-muted/40 rounded-lg px-4 py-2">
            <p className="text-[10px] text-muted-foreground">Total mensual</p>
            <p className="text-lg font-bold text-primary">{fmt(stats.totalMensual)}</p>
          </div>
          {stats.lotesPendientes > 0 && (
            <div className="text-center bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2">
              <p className="text-[10px] text-amber-400">Lotes pendientes</p>
              <p className="text-lg font-bold text-amber-400">{stats.lotesPendientes}</p>
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 w-48 text-sm"
          />
          <Button onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); }} className="gap-2 h-8 text-xs">
            <Plus className="h-3.5 w-3.5" /> Nuevo Abono
          </Button>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <DollarSign className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{search ? 'Sin resultados para tu búsqueda' : 'No hay contratos de abono configurados'}</p>
          <p className="text-xs text-muted-foreground mt-1">{search ? 'Probá con otro término' : 'Creá uno para generar todos los certificados del contrato en un click'}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(abono => (
            <AbonoMaestroCard
              key={abono.id}
              abono={abono}
              onEdit={handleEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Modal formulario */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              {editingId ? 'Editar Abono Maestro' : 'Nuevo Abono Maestro'}
            </DialogTitle>
          </DialogHeader>
          <AbonoMaestroForm
            form={form}
            setForm={setForm}
            editingId={editingId}
            onSave={() => saveMutation.mutate(form)}
            onCancel={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }}
            isSaving={saveMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}