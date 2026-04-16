import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowDownCircle, ArrowUpCircle, AlertTriangle, Package, Loader2, X, FolderKanban } from 'lucide-react';
import { toast } from 'sonner';

const unitLabels = {
  unidad: 'UN', metro: 'ML', metro2: 'm²', metro3: 'm³',
  kg: 'Kg', litro: 'Lt', bolsa: 'Bolsa', caja: 'Caja', rollo: 'Rollo',
};

const MOTIVOS_ENTRADA = [
  { value: 'compra', label: 'Compra / Recepción' },
  { value: 'devolucion', label: 'Devolución de obra' },
  { value: 'ajuste_entrada', label: 'Ajuste de inventario (+)' },
];

const MOTIVOS_SALIDA = [
  { value: 'asignacion_proyecto', label: 'Asignación a proyecto' },
  { value: 'consumo', label: 'Consumo general' },
  { value: 'perdida', label: 'Pérdida / Rotura' },
  { value: 'ajuste_salida', label: 'Ajuste de inventario (-)' },
];

export default function MovimientoDialog({ tipo: tipoInicial = 'salida', materialPreseleccionado = null, onClose }) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState(tipoInicial);
  const [materialId, setMaterialId] = useState(materialPreseleccionado?.id || '');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [proyectoId, setProyectoId] = useState('');
  const [responsable, setResponsable] = useState('');
  const [remito, setRemito] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: materials = [] } = useQuery({
    queryKey: ['materials'],
    queryFn: () => base44.entities.Material.list('name'),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('name'),
  });

  const materialSeleccionado = materials.find(m => m.id === materialId) || materialPreseleccionado;
  const motivosList = tipo === 'entrada' ? MOTIVOS_ENTRADA : MOTIVOS_SALIDA;
  const cantidadNum = parseFloat(cantidad) || 0;
  const stockNuevo = tipo === 'entrada'
    ? (materialSeleccionado?.stock || 0) + cantidadNum
    : (materialSeleccionado?.stock || 0) - cantidadNum;
  const stockInsuficiente = tipo === 'salida' && cantidadNum > (materialSeleccionado?.stock || 0);

  // reset motivo cuando cambia tipo
  useEffect(() => { setMotivo(''); setProyectoId(''); }, [tipo]);

  // auto-select motivo si hay proyecto
  useEffect(() => {
    if (proyectoId && tipo === 'salida') setMotivo('asignacion_proyecto');
  }, [proyectoId]);

  const handleSave = async () => {
    if (!materialId) { toast.error('Seleccioná un material'); return; }
    if (!cantidadNum || cantidadNum <= 0) { toast.error('La cantidad debe ser mayor a 0'); return; }
    if (!motivo) { toast.error('Seleccioná un motivo'); return; }
    if (stockInsuficiente) { toast.error('Stock insuficiente para la salida'); return; }
    if (tipo === 'salida' && motivo === 'asignacion_proyecto' && !proyectoId) {
      toast.error('Seleccioná el proyecto al que se asigna'); return;
    }

    setSaving(true);
    const mat = materialSeleccionado;
    const proyecto = projects.find(p => p.id === proyectoId);

    try {
      // 1. Registrar movimiento
      await base44.entities.MovimientoPanol.create({
        tipo,
        material_id: mat.id,
        material_nombre: mat.name,
        material_codigo: mat.code || '',
        material_unidad: mat.unit || 'unidad',
        cantidad: cantidadNum,
        stock_anterior: mat.stock || 0,
        stock_nuevo: Math.max(0, stockNuevo),
        proyecto_id: proyectoId || '',
        proyecto_nombre: proyecto?.name || '',
        motivo,
        responsable,
        remito,
        costo_unitario: mat.unit_cost || 0,
        notas,
      });

      // 2. Actualizar stock del material
      await base44.entities.Material.update(mat.id, {
        stock: Math.max(0, stockNuevo),
      });

      qc.invalidateQueries({ queryKey: ['materials'] });
      qc.invalidateQueries({ queryKey: ['movimientos-panol'] });

      toast.success(`${tipo === 'entrada' ? 'Entrada' : 'Salida'} registrada — Nuevo stock: ${Math.max(0, stockNuevo)} ${unitLabels[mat.unit] || ''}`);
      onClose?.();
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={!saving ? onClose : undefined} />
      <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            {/* Toggle entrada/salida */}
            <div className="flex rounded-xl border overflow-hidden">
              <button
                onClick={() => setTipo('entrada')}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-colors ${tipo === 'entrada' ? 'bg-emerald-500 text-white' : 'hover:bg-muted text-muted-foreground'}`}
              >
                <ArrowDownCircle className="h-4 w-4" /> Entrada
              </button>
              <button
                onClick={() => setTipo('salida')}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-colors ${tipo === 'salida' ? 'bg-orange-500 text-white' : 'hover:bg-muted text-muted-foreground'}`}
              >
                <ArrowUpCircle className="h-4 w-4" /> Salida
              </button>
            </div>
          </div>
          {!saving && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>}
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Material */}
          <div className="space-y-1.5">
            <Label>Material *</Label>
            {materialPreseleccionado ? (
              <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/30">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-semibold text-sm">{materialPreseleccionado.name}</p>
                  <p className="text-xs text-muted-foreground">Stock actual: <span className="font-bold">{materialPreseleccionado.stock} {unitLabels[materialPreseleccionado.unit] || ''}</span></p>
                </div>
              </div>
            ) : (
              <Select value={materialId} onValueChange={setMaterialId}>
                <SelectTrigger><SelectValue placeholder="Seleccioná un material..." /></SelectTrigger>
                <SelectContent>
                  {materials.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="flex items-center gap-2">
                        {m.name}
                        <span className="text-xs text-muted-foreground">— Stock: {m.stock} {unitLabels[m.unit] || ''}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Cantidad + stock preview */}
          <div className="space-y-1.5">
            <Label>Cantidad *</Label>
            <div className="flex gap-3 items-start">
              <Input
                type="number" min="0.01" step="any"
                placeholder="0"
                value={cantidad}
                onChange={e => setCantidad(e.target.value)}
                className={stockInsuficiente ? 'border-destructive' : ''}
              />
              {materialSeleccionado && cantidadNum > 0 && (
                <div className={`flex-1 rounded-xl border px-3 py-2 text-sm ${stockInsuficiente ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-muted/20'}`}>
                  <span className="text-xs text-muted-foreground block">Stock resultante</span>
                  <span className={`font-bold text-lg ${stockInsuficiente ? 'text-destructive' : stockNuevo <= (materialSeleccionado.min_stock || 0) ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {Math.max(0, stockNuevo)} {unitLabels[materialSeleccionado.unit] || ''}
                  </span>
                </div>
              )}
            </div>
            {stockInsuficiente && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Stock insuficiente (disponible: {materialSeleccionado?.stock})
              </p>
            )}
          </div>

          {/* Motivo */}
          <div className="space-y-1.5">
            <Label>Motivo *</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger><SelectValue placeholder="Seleccioná el motivo..." /></SelectTrigger>
              <SelectContent>
                {motivosList.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Proyecto (solo para salidas de asignación o cualquier salida) */}
          {tipo === 'salida' && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <FolderKanban className="h-3.5 w-3.5" />
                Proyecto {motivo === 'asignacion_proyecto' ? '*' : '(opcional)'}
              </Label>
              <Select value={proyectoId} onValueChange={setProyectoId}>
                <SelectTrigger><SelectValue placeholder="Seleccioná un proyecto..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>— Sin proyecto —</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Datos opcionales */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Responsable</Label>
              <Input placeholder="Nombre..." value={responsable} onChange={e => setResponsable(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Remito / Referencia</Label>
              <Input placeholder="R-0001..." value={remito} onChange={e => setRemito(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea placeholder="Observaciones adicionales..." value={notas} onChange={e => setNotas(e.target.value)} className="h-20 resize-none" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/20">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={saving || stockInsuficiente}
            className={tipo === 'entrada' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-orange-500 hover:bg-orange-600'}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Registrar {tipo === 'entrada' ? 'Entrada' : 'Salida'}
          </Button>
        </div>
      </div>
    </div>
  );
}